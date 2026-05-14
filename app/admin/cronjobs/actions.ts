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
import type { PipelineOutcome } from "@/lib/ingest/types";

/** Build a human-readable last-run message. On success: just the counts.
 *  On failure: counts + the first concrete error reason pulled from the run
 *  log (provider/billing/auth errors, etc.) so the cause is visible in the
 *  Trigger toast and the cron list "Last run" cell — not buried in the
 *  IngestRuns.Log blob. */
function summarizeOutcome(o: PipelineOutcome): string {
  const counts =
    `inserted=${o.inserted} skipped=${o.skipped} errored=${o.errored}`;
  if (o.errored === 0) return counts;

  const errLine = o.log.find((l) => /\s+error:/i.test(l));
  if (!errLine) return counts;

  // Strip leading "[tag]" prefix and "...error:" preamble.
  let m = errLine
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/^.*?error:\s*/i, "")
    .trim();

  // Provider responses are often JSON envelopes — pull out the human
  // message field if present (Anthropic / OpenAI / similar shapes).
  const jsonMsg = m.match(/"message"\s*:\s*"((?:[^"\\]|\\.)+)"/);
  if (jsonMsg) m = jsonMsg[1];

  if (m.length > 280) m = m.slice(0, 277) + "...";
  return `${counts}. ${m}`;
}

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
  const routerMode = (str(fd, "ArticleMode") ?? "single") === "router";
  const seedQuery = str(fd, "SeedQuery");
  const targetCatRaw = str(fd, "TargetCatID");
  const targetCatId = targetCatRaw ? Number(targetCatRaw) : null;

  let mirrorCatId: number | null = null;
  if (routerMode) {
    config.routerMode = true;
    config.maxCategoriesPerTick = Math.max(
      1,
      Math.min(30, num(fd, "MaxCategoriesPerTick", 8)),
    );
    config.perCategoryTrendLimit = Math.max(
      3,
      Math.min(25, num(fd, "PerCategoryTrendLimit", 8)),
    );
  } else {
    if (!seedQuery) return "article_seed";
    if (!targetCatId || !Number.isFinite(targetCatId)) {
      return "article_target_cat";
    }
    config.seedQuery = seedQuery;
    config.targetCatId = targetCatId;
    mirrorCatId = targetCatId;
  }

  config.ideationBatchCount = Math.max(
    5,
    Math.min(50, num(fd, "IdeationBatchCount", 20)),
  );
  const trendsLocation = str(fd, "TrendsLocation");
  const trendsLanguage = str(fd, "TrendsLanguage");
  const trendsWindow = str(fd, "TrendsWindow");
  const guidance = str(fd, "Guidance");
  if (trendsLocation) config.trendsLocation = trendsLocation.toLowerCase();
  if (trendsLanguage) config.trendsLanguage = trendsLanguage.toLowerCase();
  if (trendsWindow) config.trendsWindow = trendsWindow;
  if (guidance) config.guidance = guidance;
  config.autoRefill = bool(fd, "AutoRefill");
  config.publishStaggerMinutes = Math.max(
    0,
    Math.min(120, num(fd, "PublishStaggerMinutes", 15)),
  );

  return {
    jobName,
    kind,
    catId: mirrorCatId,           // null in router mode (FK_CatID stays empty)
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
  // Hoisted so the catch block can persist whatever the pipeline managed to
  // log before throwing — otherwise fatal errors lose all step context.
  const partialLog: string[] = [];

  try {
    if (job.Kind === "article") {
      const outcome = await runArticleJobTick({ job });
      message = summarizeOutcome(outcome);
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
        log: partialLog,
      });
      message = summarizeOutcome(outcome);
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
      message = summarizeOutcome(outcome);
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
    const fatalLog = [...partialLog, `[fatal] ${message}`].join("\n");
    await finishIngestRun(runId, {
      inserted: 0, skipped: 0, errored: 1, status, log: fatalLog,
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
 *  rows in /admin/cronjobs. Fires the heavy SerpAPI + Meta AI work in the
 *  background so the admin UI doesn't freeze (server actions block other
 *  actions/navigation while awaited). Result is recorded in audit logs. */
export async function refillArticleJobAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  const job = await getCronJob(id);
  if (!job) throw new Error("Job not found.");
  if (job.Kind !== "article") throw new Error("Refill is only for article jobs.");

  // revalidateTag must be called from the action body, not from a detached
  // promise — Next 15 throws DYNAMIC_SERVER_USAGE otherwise. The synchronous
  // revalidateTag below covers the cronjobs list; drafts pick up fresh data
  // via their own revalidate window or the next manual refresh.
  void (async () => {
    const log: string[] = [];
    try {
      const result = await ideateForJob({ job, log });
      await logAudit(
        "cronjobs",
        `"${job.JobName}" article job refilled (saved=${result.saved}, dup=${result.duplicates})`,
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      await logAudit("cronjobs", `"${job.JobName}" refill failed: ${m}`);
    }
  })();

  await logAudit("cronjobs", `"${job.JobName}" refill started in background`);
  revalidateTag("cronjobs");
}
