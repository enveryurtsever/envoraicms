import "server-only";
import { sql } from "@/lib/db";
import type { CronJob } from "@/lib/types";
import type { IngestCategory, PipelineOutcome } from "@/lib/ingest/types";
import { assertPreflightOk } from "@/lib/queries/preflight";
import { ideateForJob } from "./article-ideation";
import { expandArticleDraft } from "./article-expand";
import {
  listPendingArticleDrafts,
  claimArticleDraft,
  countPendingForCron,
  markArticleDone,
  markArticleError,
} from "./article-drafts";

/** One tick of an Article-kind cron job:
 *   1. If pending=0 and (autoRefill || forceRefill): ideate a fresh batch.
 *   2. Expand min(ArticlesPerRun, pending) drafts → Contents rows. */
export async function runArticleJobTick(args: {
  job: CronJob;
  forceRefill?: boolean;
}): Promise<PipelineOutcome> {
  const { job, forceRefill = false } = args;
  const log: string[] = [];
  const result: PipelineOutcome = { inserted: 0, skipped: 0, errored: 0, log };

  await assertPreflightOk();

  if (job.Kind !== "article") {
    throw new Error(`runArticleJobTick called on non-article job (Kind=${job.Kind})`);
  }
  const cfg = job.Config ?? {};
  const targetCatId = typeof cfg.targetCatId === "number" ? cfg.targetCatId : null;
  if (!targetCatId) throw new Error("Article job missing targetCatId in Config");
  const cat = await loadCategory(targetCatId);
  if (!cat) throw new Error(`Target category #${targetCatId} not active`);
  const imageProvider: "passthrough" | "falai" =
    job.ImageAiProvider === "falai" ? "falai" : "passthrough";

  // Step 1 — refill if needed.
  let pending = await countPendingForCron(job.CronID);
  log.push(`[article#${job.CronID}] pending=${pending}`);

  if (pending === 0) {
    if (forceRefill || cfg.autoRefill) {
      try {
        const refill = await ideateForJob({ job, log });
        log.push(
          `[article#${job.CronID}] refill: trends=${refill.trendCount} saved=${refill.saved} dup=${refill.duplicates}`,
        );
        pending = await countPendingForCron(job.CronID);
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        log.push(`[article#${job.CronID}] refill failed: ${m}`);
        result.errored += 1;
        return result;
      }
    } else {
      log.push(`[article#${job.CronID}] no pending, autoRefill=off → no-op`);
      return result;
    }
  }

  // Step 2 — expand up to ArticlesPerRun drafts.
  const limit = Math.max(1, job.ArticlesPerRun || 1);
  const drafts = await listPendingArticleDrafts({ cronId: job.CronID, limit });

  for (const candidate of drafts) {
    const draft = await claimArticleDraft(candidate.DraftID);
    if (!draft) continue;
    try {
      const contentId = await expandArticleDraft({
        draft,
        category: cat,
        imageProvider,
        log,
      });
      await markArticleDone({ id: draft.DraftID, contentId });
      result.inserted += 1;
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      await markArticleError(draft.DraftID, m);
      log.push(`[draft#${draft.DraftID}] error: ${m}`);
      result.errored += 1;
    }
  }
  return result;
}

async function loadCategory(catId: number): Promise<IngestCategory | null> {
  const rows = await sql<IngestCategory[]>`
    SELECT "CatID","CatName","CatSeo" FROM "Categories"
    WHERE "CatID" = ${catId} AND "IsActive" = TRUE AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  return rows[0] ?? null;
}
