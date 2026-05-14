import "server-only";
import type { CronJob } from "@/lib/types";
import {
  getIngestCategory,
  startIngestRun,
  finishIngestRun,
} from "@/lib/ingest/db";
import { listDueCronJobs, markCronRun } from "@/lib/queries/cronjobs";
import { runPipeline } from "@/lib/ingest/pipeline";
import { runNewsNowJob } from "@/lib/ingest/pipeline-newsnow";
import { runArticleJobTick } from "@/lib/ingest/pipeline-article";
import { nextRun } from "@/lib/ingest/cron";
import { makeNewsApi14Provider } from "@/lib/ingest/providers/news/newsapi14";
import { makeGeminiProvider } from "@/lib/ingest/providers/text/gemini";
import { makeFalaiProvider } from "@/lib/ingest/providers/image/falai";
import { makePassthroughProvider } from "@/lib/ingest/providers/image/passthrough";
import type {
  ImageProvider,
  NewsProvider,
  TextAiProvider,
} from "@/lib/ingest/types";

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

/** Execute one cron job end-to-end and persist the IngestRun + bump NextRunAt.
 *  Errors are caught and logged; the function never throws so the caller can
 *  iterate through jobs without aborting the batch. */
export async function runOneCronJob(job: CronJob): Promise<void> {
  const jobLabel = `#${job.CronID} ${job.JobName}`;
  console.log(
    `[runner] start ${jobLabel} (kind=${job.Kind} provider=${job.NewsProvider ?? "newsapi"})`,
  );
  const runId = await startIngestRun(job.CronID, job.FK_CatID);
  let status: "ok" | "error" | "skipped" = "ok";
  let message = "";
  const partialLog: string[] = [];

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
      if (!cfg.newsCategory) throw new Error("NewsNow category missing in job config");
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
    const fatalLog = [...partialLog, `[fatal] ${message}`].join("\n");
    await finishIngestRun(runId, {
      inserted: 0,
      skipped: 0,
      errored: 1,
      status,
      log: fatalLog,
    });
    console.error(`[runner] ${jobLabel} failed:`, message);
  }

  let next: Date | null = null;
  try {
    next = nextRun(job.FrequencyCron);
  } catch (e) {
    console.error(`[runner] ${jobLabel} bad cron expression:`, e);
  }
  await markCronRun(job.CronID, status, message, next);
  console.log(
    `[runner] done  ${jobLabel} status=${status} next=${next?.toISOString() ?? "?"}`,
  );
}

/** Run every cron job whose NextRunAt has elapsed. Used by both the standalone
 *  script (scripts/ingest-runner.ts) and the in-process scheduler. */
export async function runDueCronJobs(): Promise<{ count: number }> {
  const jobs = await listDueCronJobs();
  if (jobs.length === 0) return { count: 0 };
  console.log(`[runner] due jobs: ${jobs.length}`);
  for (const job of jobs) {
    await runOneCronJob(job);
  }
  return { count: jobs.length };
}
