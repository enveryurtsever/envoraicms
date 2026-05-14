import "server-only";
import { sql } from "@/lib/db";
import type { CronJob } from "@/lib/types";
import type { IngestCategory, PipelineOutcome } from "@/lib/ingest/types";
import { assertPreflightOk } from "@/lib/queries/preflight";
import { buildAuthorPicker } from "@/lib/queries/authors";
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
 *      Skipped entirely when refillIfEmpty=false (used by the scheduler's
 *      every-minute drain pass — refill stays bound to the cron schedule).
 *   2. Expand all pending drafts → Contents rows with future PublishDates. */
export async function runArticleJobTick(args: {
  job: CronJob;
  forceRefill?: boolean;
  refillIfEmpty?: boolean;
}): Promise<PipelineOutcome> {
  const { job, forceRefill = false, refillIfEmpty = true } = args;
  const log: string[] = [];
  const result: PipelineOutcome = { inserted: 0, skipped: 0, errored: 0, log };

  await assertPreflightOk();

  if (job.Kind !== "article") {
    throw new Error(`runArticleJobTick called on non-article job (Kind=${job.Kind})`);
  }
  const cfg = job.Config ?? {};
  const routerMode = cfg.routerMode === true;
  const targetCatId =
    typeof cfg.targetCatId === "number" ? cfg.targetCatId : null;
  if (!routerMode && !targetCatId) {
    throw new Error("Article job missing targetCatId in Config");
  }
  // In single-cat mode we keep one preloaded category; router mode resolves
  // per-draft below since drafts may belong to any active category.
  const fixedCat = routerMode
    ? null
    : await loadCategory(targetCatId as number);
  if (!routerMode && !fixedCat) {
    throw new Error(`Target category #${targetCatId} not active`);
  }
  const imageProvider: "passthrough" | "falai" =
    job.ImageAiProvider === "falai" ? "falai" : "passthrough";

  // Step 1 — refill if needed.
  let pending = await countPendingForCron(job.CronID);
  log.push(`[article#${job.CronID}] pending=${pending}`);

  if (pending === 0) {
    if (forceRefill || (refillIfEmpty && cfg.autoRefill)) {
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

  // Step 2 — expand ALL pending drafts in this tick. Each gets a future
  // PublishDate spaced by `publishStaggerMinutes` — the activator then
  // flips IsActive=TRUE as each scheduled time arrives. ArticlesPerRun is
  // intentionally not used here: it's the ideation batch size, not a cap
  // on expansion. Capping expansion would leave drafts un-scheduled.
  const publishStagger = Math.max(
    0,
    typeof cfg.publishStaggerMinutes === "number" ? cfg.publishStaggerMinutes : 15,
  );
  // High cap (50) is a safety net so a runaway ideation can't hang one tick
  // forever. ideationBatchCount is clamped to 50 elsewhere, so in practice
  // this matches the largest plausible refill.
  const [drafts, pickAuthor] = await Promise.all([
    listPendingArticleDrafts({ cronId: job.CronID, limit: 50 }),
    buildAuthorPicker(),
  ]);

  for (const candidate of drafts) {
    const draft = await claimArticleDraft(candidate.DraftID);
    if (!draft) continue;
    try {
      const draftCat =
        fixedCat && draft.FK_CatID === fixedCat.CatID
          ? fixedCat
          : await loadCategory(draft.FK_CatID);
      if (!draftCat) {
        throw new Error(`Draft category #${draft.FK_CatID} not active`);
      }
      const contentId = await expandArticleDraft({
        draft,
        category: draftCat,
        imageProvider,
        log,
        pickAuthor,
        staggerMinutes: result.inserted * publishStagger,
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
