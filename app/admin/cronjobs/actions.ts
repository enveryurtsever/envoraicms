"use server";
import { revalidateTag } from "next/cache";
import { getSession, requireRole } from "@/lib/auth/session";
import {
  createCronJob,
  getCronJob,
  markCronRun,
  softDeleteCronJob,
  updateCronJob,
} from "@/lib/queries/cronjobs";
import { nextRun, parseCron } from "@/lib/ingest/cron";
import { startIngestRun, finishIngestRun, getIngestCategory } from "@/lib/ingest/db";
import { runPipeline } from "@/lib/ingest/pipeline";
import { runNewsNowJob } from "@/lib/ingest/pipeline-newsnow";
import { runArticleJobTick } from "@/lib/ingest/pipeline-article";
import { ideateForJob } from "@/lib/ingest/article-ideation";
import { makeNewsApi14Provider } from "@/lib/ingest/providers/news/newsapi14";
import { makeGeminiProvider } from "@/lib/ingest/providers/text/gemini";
import { makeFalaiProvider } from "@/lib/ingest/providers/image/falai";
import { makePassthroughProvider } from "@/lib/ingest/providers/image/passthrough";
import type {
  CronJobConfig,
  CronJobKind,
} from "@/lib/types";
import type {
  ImageProvider,
  NewsProvider,
  TextAiProvider,
} from "@/lib/ingest/types";
import { logAudit } from "@/lib/audit";

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
function num(fd: FormData, k: string, def = 0): number {
  const v = Number(fd.get(k));
  return Number.isFinite(v) ? v : def;
}
function bool(fd: FormData, k: string): boolean {
  return fd.get(k) === "on" || fd.get(k) === "true";
}

type Parsed = {
  jobName: string;
  kind: CronJobKind;
  catId: number | null;
  newsProvider: string | null;
  textAiProvider: string | null;
  imageAiProvider: string | null;
  frequencyCron: string;
  articlesPerRun: number;
  config: CronJobConfig;
  isActive: boolean;
};

function parseForm(fd: FormData): Parsed | string {
  const jobName = str(fd, "JobName");
  const cron = str(fd, "FrequencyCron");
  if (!jobName || !cron) return "missing";
  try {
    parseCron(cron);
  } catch {
    return "cron";
  }

  const kindRaw = str(fd, "Kind");
  const kind: CronJobKind = kindRaw === "article" ? "article" : "news";

  const config: CronJobConfig = {};

  if (kind === "news") {
    const catRaw = str(fd, "FK_CatID");
    const catId = catRaw ? Number(catRaw) : null;
    if (catRaw && !Number.isFinite(catId)) return "cat";

    const provider = str(fd, "NewsProvider");
    if (provider === "newsnow") {
      const newsCategory = str(fd, "NewsCategory");
      const location = str(fd, "Location");
      const language = str(fd, "Language");
      const page = num(fd, "Page", 1);
      if (!newsCategory) return "newsnow_category";
      config.newsCategory = newsCategory.toUpperCase();
      if (location) config.location = location.toLowerCase();
      if (language) config.language = language.toLowerCase();
      if (page > 0) config.page = page;
    }

    return {
      jobName,
      kind,
      catId,
      newsProvider: provider,
      textAiProvider: str(fd, "TextAiProvider"),
      imageAiProvider: str(fd, "ImageAiProvider"),
      frequencyCron: cron,
      articlesPerRun: Math.max(1, num(fd, "ArticlesPerRun", 3)),
      config,
      isActive: bool(fd, "IsActive"),
    };
  }

  // Article kind — SerpAPI seed + multi-provider AI.
  const seedQuery = str(fd, "SeedQuery");
  const targetCatRaw = str(fd, "TargetCatID");
  const targetCatId = targetCatRaw ? Number(targetCatRaw) : null;
  if (!seedQuery) return "article_seed";
  if (!targetCatId || !Number.isFinite(targetCatId)) return "article_target_cat";
  const ideationBatchCount = Math.max(5, Math.min(50, num(fd, "IdeationBatchCount", 20)));
  const trendsLocation = str(fd, "TrendsLocation");
  const trendsLanguage = str(fd, "TrendsLanguage");
  const guidance = str(fd, "Guidance");
  config.seedQuery = seedQuery;
  config.targetCatId = targetCatId;
  config.ideationBatchCount = ideationBatchCount;
  if (trendsLocation) config.trendsLocation = trendsLocation.toLowerCase();
  if (trendsLanguage) config.trendsLanguage = trendsLanguage.toLowerCase();
  if (guidance) config.guidance = guidance;
  config.autoRefill = bool(fd, "AutoRefill");

  return {
    jobName,
    kind,
    catId: targetCatId,           // mirror to FK_CatID for filtering / dashboard widgets
    newsProvider: null,
    textAiProvider: null,
    imageAiProvider: str(fd, "ImageAiProvider"),
    frequencyCron: cron,
    articlesPerRun: Math.max(1, num(fd, "ArticlesPerRun", 2)),
    config,
    isActive: bool(fd, "IsActive"),
  };
}

function errorMessage(code: string): string {
  switch (code) {
    case "missing":             return "Job name and cron expression are required.";
    case "cron":                return "Invalid cron expression.";
    case "cat":                 return "Invalid category.";
    case "newsnow_category":    return "NewsNow news category is required (e.g. TECHNOLOGY).";
    case "article_seed":        return "Seed query is required for article jobs.";
    case "article_target_cat":  return "Target category is required for article jobs.";
    default:                    return "Could not save cron job.";
  }
}

export async function createCronJobAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const sess = await getSession();
  const parsed = parseForm(fd);
  if (typeof parsed === "string") throw new Error(errorMessage(parsed));
  const next = (() => {
    try { return nextRun(parsed.frequencyCron); } catch { return null; }
  })();
  await createCronJob({
    ...parsed,
    nextRunAt: next,
    creatorId: sess?.uid ?? null,
  });
  await logAudit("cronjobs", `"${parsed.jobName}" cron job added`);
  revalidateTag("cronjobs");
}

export async function updateCronJobAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  const parsed = parseForm(fd);
  if (typeof parsed === "string") throw new Error(errorMessage(parsed));
  const next = (() => {
    try { return nextRun(parsed.frequencyCron); } catch { return null; }
  })();
  await updateCronJob(id, { ...parsed, nextRunAt: next });
  await logAudit("cronjobs", `"${parsed.jobName}" cron job updated`);
  revalidateTag("cronjobs");
}

export async function deleteCronJobAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  await softDeleteCronJob(id);
  await logAudit("cronjobs", `#${id} cron job deleted`);
  revalidateTag("cronjobs");
}

async function makeNews(name: string | null): Promise<NewsProvider> {
  const provider = name ?? "newsapi";
  if (provider === "newsapi") return makeNewsApi14Provider();
  throw new Error(`Unsupported news provider: ${provider}`);
}

async function makeText(name: string | null): Promise<TextAiProvider> {
  const provider = name ?? "gemini";
  if (provider === "gemini") return makeGeminiProvider();
  throw new Error(`Unsupported text AI provider: ${provider}`);
}

async function makeImage(name: string | null): Promise<ImageProvider> {
  if (!name || name === "passthrough") return makePassthroughProvider();
  if (name === "falai") return makeFalaiProvider();
  throw new Error(`Unsupported image provider: ${name}`);
}

export async function triggerCronJobAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  const job = await getCronJob(id);
  if (!job) throw new Error("Job not found.");

  const runId = await startIngestRun(job.CronID, job.FK_CatID);
  let status: "ok" | "error" | "skipped" = "ok";
  let message = "";

  try {
    if (job.Kind === "article") {
      const outcome = await runArticleJobTick({ job });
      message = `inserted=${outcome.inserted} skipped=${outcome.skipped} errored=${outcome.errored}`;
      status = outcome.errored > 0 && outcome.inserted === 0 ? "error" : "ok";
      await finishIngestRun(runId, {
        inserted: outcome.inserted,
        skipped: outcome.skipped,
        errored: outcome.errored,
        status,
        log: outcome.log.join("\n"),
      });
    } else if (job.NewsProvider === "newsnow") {
      const cfg = job.Config ?? {};
      if (!cfg.newsCategory) throw new Error("NewsNow category missing in job config.");
      const outcome = await runNewsNowJob({
        cronId: job.CronID,
        params: {
          category: cfg.newsCategory,
          location: cfg.location,
          language: cfg.language,
          page: cfg.page,
        },
        articlesPerRun: job.ArticlesPerRun,
      });
      message = `inserted=${outcome.inserted} skipped=${outcome.skipped} errored=${outcome.errored}`;
      status = outcome.errored > 0 && outcome.inserted === 0 ? "error" : "ok";
      await finishIngestRun(runId, {
        inserted: outcome.inserted,
        skipped: outcome.skipped,
        errored: outcome.errored,
        status,
        log: outcome.log.join("\n"),
      });
    } else {
      // Legacy newsapi/per-category flow.
      if (!job.FK_CatID) throw new Error("CronJob has no FK_CatID");
      const cat = await getIngestCategory(job.FK_CatID);
      if (!cat) throw new Error(`Category ${job.FK_CatID} not active`);
      const news = await makeNews(job.NewsProvider);
      const text = await makeText(job.TextAiProvider);
      const image = await makeImage(job.ImageAiProvider);
      const imageFallback =
        job.ImageAiProvider === "falai" ? makePassthroughProvider() : undefined;
      const outcome = await runPipeline({
        cat,
        articlesPerRun: job.ArticlesPerRun,
        news,
        text,
        image,
        imageFallback,
      });
      message = `inserted=${outcome.inserted} skipped=${outcome.skipped} errored=${outcome.errored}`;
      status = outcome.errored > 0 && outcome.inserted === 0 ? "error" : "ok";
      await finishIngestRun(runId, {
        inserted: outcome.inserted,
        skipped: outcome.skipped,
        errored: outcome.errored,
        status,
        log: outcome.log.join("\n"),
      });
    }
  } catch (err) {
    status = "error";
    message = err instanceof Error ? err.message : String(err);
    await finishIngestRun(runId, {
      inserted: 0, skipped: 0, errored: 1, status, log: `[fatal] ${message}`,
    });
  }

  let next: Date | null = null;
  try { next = nextRun(job.FrequencyCron); } catch { /* ignore */ }
  await markCronRun(job.CronID, status, message, next);
  await logAudit(
    "cronjobs",
    `"${job.JobName}" cron job manually triggered (${status})`,
  );
  revalidateTag("cronjobs");
  if (status === "error") throw new Error(message || "Job run failed.");
}

/** Force-ideate a fresh batch of article drafts for the given job, even if
 *  pending drafts already exist. Used by the "🔁 Refill" button on Article
 *  rows in /admin/cronjobs. */
export async function refillArticleJobAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  const job = await getCronJob(id);
  if (!job) throw new Error("Job not found.");
  if (job.Kind !== "article") throw new Error("Refill is only for article jobs.");

  const log: string[] = [];
  const result = await ideateForJob({ job, log });
  await logAudit(
    "cronjobs",
    `"${job.JobName}" article job refilled (saved=${result.saved}, dup=${result.duplicates})`,
  );
  revalidateTag("cronjobs");
  revalidateTag("article-drafts");
  if (result.saved === 0 && result.trendCount === 0) {
    throw new Error("SerpAPI returned no trends — nothing to ideate.");
  }
}
