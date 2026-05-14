import "server-only";
import { sql } from "@/lib/db";
import type { CronJob } from "@/lib/types";
import { buildContentUrl, submitIndexingFireAndForget } from "@/lib/indexing/submit";
import { runArticleJobTick } from "@/lib/ingest/pipeline-article";

type DueRow = {
  ContentID: number;
  ContentSeo: string;
  CatSeo: string;
};

// Flips IsActive=TRUE for any Contents row whose scheduled PublishDate has
// arrived, then fires a Google indexing dispatch for each newly-live row.
// Called once per scheduler tick (every 60s) and is cluster-safe via the
// outer pg_advisory_lock the scheduler already holds during a tick.
export async function activateScheduledArticles(): Promise<number> {
  const due = await sql<DueRow[]>`
    UPDATE "Contents" c
       SET "IsActive" = TRUE
      FROM "Categories" cat
     WHERE c."FK_CatID"   = cat."CatID"
       AND c."IsActive"   = FALSE
       AND c."IsDeleted"  = FALSE
       AND c."PublishDate" <= NOW()
    RETURNING c."ContentID", c."ContentSeo", cat."CatSeo"
  `;

  for (const row of due) {
    try {
      const url = await buildContentUrl(row.CatSeo, row.ContentSeo);
      submitIndexingFireAndForget(row.ContentID, url, "URL_UPDATED");
    } catch {
      // submitIndexingFireAndForget already logs failures to IndexingLog;
      // ignore here so one bad row doesn't block activation of the rest.
    }
  }

  return due.length;
}

// Drains pending ArticleDrafts on every scheduler tick — independent of the
// per-job FrequencyCron. The cron schedule still governs *when refill runs*
// (passing refillIfEmpty=false here), but expansion of already-staged drafts
// shouldn't have to wait for the next cron window.
export async function drainPendingArticleQueues(): Promise<void> {
  const jobs = await sql<CronJob[]>`
    SELECT j.*
      FROM "CronJobs" j
     WHERE j."Kind" = 'article'
       AND j."IsActive"  = TRUE
       AND j."IsDeleted" = FALSE
       AND EXISTS (
             SELECT 1 FROM "ArticleDrafts" d
              WHERE d."FK_CronID" = j."CronID"
                AND d."Status"    = 'pending'
           )
  `;

  for (const job of jobs) {
    try {
      await runArticleJobTick({ job, refillIfEmpty: false });
    } catch (err) {
      console.error(
        `[drain] article job #${job.CronID} ${job.JobName} failed:`,
        err,
      );
    }
  }
}
