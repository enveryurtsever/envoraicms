/**
 * Pulled by the systemd timer every 10 minutes. Picks up due CronJobs and
 * runs them: NewsNow jobs go through the new fetch→draft→Gemini→insert
 * pipeline; legacy newsapi jobs use the original per-category pipeline.
 *
 * Run: npm run ingest:runner
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

import { sql } from "../lib/db";
import { getIngestCategory, startIngestRun, finishIngestRun } from "../lib/ingest/db";
import { listDueCronJobs, markCronRun } from "../lib/queries/cronjobs";
import { runPipeline } from "../lib/ingest/pipeline";
import { runNewsNowJob } from "../lib/ingest/pipeline-newsnow";
import { runArticleJobTick } from "../lib/ingest/pipeline-article";
import { nextRun } from "../lib/ingest/cron";
import { makeNewsApi14Provider } from "../lib/ingest/providers/news/newsapi14";
import { makeGeminiProvider } from "../lib/ingest/providers/text/gemini";
import { makeFalaiProvider } from "../lib/ingest/providers/image/falai";
import { makePassthroughProvider } from "../lib/ingest/providers/image/passthrough";
import type { ImageProvider, NewsProvider, TextAiProvider } from "../lib/ingest/types";

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

async function main() {
  const jobs = await listDueCronJobs();
  console.log(`[runner] due jobs: ${jobs.length}`);
  for (const job of jobs) {
    const jobLabel = `#${job.CronID} ${job.JobName}`;
    console.log(`[runner] start ${jobLabel} (provider=${job.NewsProvider ?? "newsapi"})`);
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
        const imageFallback = job.ImageAiProvider === "falai"
          ? makePassthroughProvider()
          : undefined;

        const outcome = await runPipeline({
          cat,
          articlesPerRun: job.ArticlesPerRun,
          news,
          text,
          image,
          imageFallback,
        });

        const logStr = outcome.log.join("\n");
        message = `inserted=${outcome.inserted} skipped=${outcome.skipped} errored=${outcome.errored}`;
        status = outcome.errored > 0 && outcome.inserted === 0 ? "error" : "ok";
        await finishIngestRun(runId, {
          inserted: outcome.inserted,
          skipped: outcome.skipped,
          errored: outcome.errored,
          status,
          log: logStr,
        });
      }
    } catch (err) {
      status = "error";
      message = err instanceof Error ? err.message : String(err);
      await finishIngestRun(runId, {
        inserted: 0,
        skipped: 0,
        errored: 1,
        status,
        log: `[fatal] ${message}`,
      });
      console.error(`[runner] ${jobLabel} failed:`, message);
    }

    let next: Date | null = null;
    try {
      next = nextRun(job.FrequencyCron);
    } catch (err) {
      console.error(`[runner] ${jobLabel} bad cron expression:`, err);
    }
    await markCronRun(job.CronID, status, message, next);
    console.log(`[runner] done  ${jobLabel} status=${status} next=${next?.toISOString() ?? "?"}`);
  }
}

main()
  .catch((err) => {
    console.error("[runner][fatal]", err);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
