import "server-only";
import { sql } from "@/lib/db";
import type {
  IngestCategory,
  NewsNowArticle,
  NewsNowFetchParams,
  PipelineOutcome,
  RewrittenWithCategory,
} from "@/lib/ingest/types";
import { fetchNewsNow, externalIdFor } from "./providers/news/newsnow";
import { rewriteWithCategory } from "./rewrite-with-category";
import { downloadAndStoreImage } from "./download-image";
import {
  saveDraft,
  claimDraft,
  markDone,
  markSkipped,
  markError,
  type Draft,
} from "./drafts";
import { ensureUniqueSlug } from "./db";

const PROVIDER = "newsnow";

async function loadActiveCategories(): Promise<IngestCategory[]> {
  return sql<IngestCategory[]>`
    SELECT "CatID", "CatName", "CatSeo"
    FROM "Categories"
    WHERE "IsActive" = TRUE AND "IsDeleted" = FALSE
    ORDER BY "CatNumber" ASC NULLS LAST, "CatID" ASC
  `;
}

async function isUrlAlreadyIngested(url: string): Promise<boolean> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "Contents" WHERE "ContentURL" = ${url}
  `;
  return (rows[0]?.c ?? 0) > 0;
}

async function insertContentFromDraft(args: {
  cat: IngestCategory;
  draft: Draft;
  rewritten: RewrittenWithCategory;
  imagePath: string;
  publisherName: string | null;
  staggerMinutes: number;
}): Promise<number> {
  const { cat, draft, rewritten, imagePath, publisherName, staggerMinutes } = args;
  const slug = await ensureUniqueSlug(rewritten.slug);
  const source = publisherName
    ? JSON.stringify({ title: publisherName, href: draft.SourceUrl ?? "" })
    : null;
  const homepage = rewritten.importance >= 7;
  const { getRandomAuthorForCategory } = await import("@/lib/queries/authors");
  const author = await getRandomAuthorForCategory(cat.CatID);
  const rows = await sql<{ ContentID: number }[]>`
    INSERT INTO "Contents" (
      "FK_CatID","FK_LangID","ContentTitle","ContentShort","ContentDetail",
      "ContentKeywords","ContentDesc","ContentImage","ContentSeo",
      "ContentURL","ContentSource","Homepage","IsActive","IsDeleted",
      "PublishDate","ModifiedDate","CreatedDate","ImagePrompt","FK_AuthorID"
    ) VALUES (
      ${cat.CatID}, 1, ${rewritten.title}, ${rewritten.short}, ${rewritten.detail},
      ${rewritten.keywords}, ${rewritten.desc}, ${imagePath}, ${slug},
      ${draft.SourceUrl}, ${source}, ${homepage}, TRUE, FALSE,
      NOW() - (${staggerMinutes} || ' minutes')::interval,
      NOW() - (${staggerMinutes} || ' minutes')::interval,
      NOW(),
      ${rewritten.imagePrompt ?? null},
      ${author?.AuthorID ?? null}
    )
    RETURNING "ContentID"
  `;
  return rows[0].ContentID;
}

/**
 * STAGE 1 — fetch articles from NewsNow and stage them as drafts.
 * Idempotent: existing (provider, url) pairs are skipped via the unique index.
 * Returns counts only; the actual rewrite step runs in `processPendingDrafts`.
 */
export async function fetchAndStageNewsNow(args: {
  cronId: number | null;
  params: NewsNowFetchParams;
  log: string[];
}): Promise<{ fetched: number; saved: number; duplicates: number }> {
  const { cronId, params, log } = args;
  log.push(`[newsnow] fetch category=${params.category} loc=${params.location ?? "us"} lang=${params.language ?? "en"}`);

  const articles = await fetchNewsNow({ ...params, limit: params.limit ?? 20 });
  log.push(`[newsnow] received ${articles.length} articles`);

  let saved = 0;
  let duplicates = 0;
  for (const article of articles) {
    const ext = externalIdFor(article);
    if (ext && (await isUrlAlreadyIngested(ext))) {
      duplicates += 1;
      continue;
    }
    const id = await saveDraft({
      provider: PROVIDER,
      externalId: ext,
      raw: article,
      cronId,
    });
    if (id) saved += 1;
    else duplicates += 1;
  }
  log.push(`[newsnow] staged ${saved} new drafts (${duplicates} duplicates)`);
  return { fetched: articles.length, saved, duplicates };
}

/**
 * STAGE 2 — process up to `limit` pending drafts: rewrite with Gemini, pick a
 * site category, download the top image, insert a Contents row, and mark the
 * draft done. Errors are recorded on the draft so they can be retried.
 */
export async function processPendingDrafts(args: {
  limit: number;
  log: string[];
}): Promise<PipelineOutcome> {
  const { limit, log } = args;
  const result: PipelineOutcome = { inserted: 0, skipped: 0, errored: 0, log };

  const categories = await loadActiveCategories();
  if (categories.length === 0) {
    log.push("[newsnow] no active categories — abort");
    return result;
  }

  // Read up to `limit` pending drafts (older first), then process one by one.
  const pendingIds = await sql<{ DraftID: string }[]>`
    SELECT "DraftID"::text AS "DraftID" FROM "NewsApiDrafts"
    WHERE "Status" = 'pending'
    ORDER BY "FetchedAt" ASC
    LIMIT ${limit}
  `;

  for (const row of pendingIds) {
    const draft = await claimDraft(row.DraftID);
    if (!draft) continue;
    try {
      const article = draft.RawJSON;
      const hint =
        typeof (article as { category?: unknown }).category === "string"
          ? ((article as { category?: string }).category as string)
          : null;

      log.push(`[draft#${draft.DraftID}] rewriting "${article.title?.slice(0, 70) ?? ""}"`);
      const rewritten = await rewriteWithCategory({
        article,
        categories,
        hintCategory: hint,
      });

      if (rewritten.skip) {
        const reason = rewritten.skipReason || "skipped";
        await markSkipped(draft.DraftID, reason);
        log.push(`[draft#${draft.DraftID}] skipped: ${reason}`);
        result.skipped += 1;
        continue;
      }

      // Resolve target category — fall back to first active category if Gemini
      // didn't (or couldn't) pick one.
      const cat =
        (rewritten.categorySlug
          ? categories.find((c) => c.CatSeo === rewritten.categorySlug)
          : null) ?? categories[0];

      // Download image (best-effort). On failure we keep the original URL
      // so the article still has a thumbnail path.
      let imagePath = draft.TopImage ?? "";
      if (draft.TopImage) {
        try {
          imagePath = await downloadAndStoreImage({
            url: draft.TopImage,
            bucket: "content",
            slug: rewritten.slug,
          });
        } catch (err) {
          log.push(
            `[draft#${draft.DraftID}] image download failed: ${
              err instanceof Error ? err.message : String(err)
            } (keeping original URL)`,
          );
        }
      }

      const publisherName =
        article.publisher?.name ?? null;

      const stagger = result.inserted * 7;
      const contentId = await insertContentFromDraft({
        cat,
        draft,
        rewritten,
        imagePath,
        publisherName,
        staggerMinutes: stagger,
      });
      await markDone({ id: draft.DraftID, catId: cat.CatID, contentId });
      log.push(
        `[draft#${draft.DraftID}] inserted Content#${contentId} into ${cat.CatSeo}`,
      );
      result.inserted += 1;
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      await markError(draft.DraftID, m);
      log.push(`[draft#${draft.DraftID}] error: ${m}`);
      result.errored += 1;
    }
  }
  return result;
}

/** End-to-end run for one cron job: fetch + immediately process up to N. */
export async function runNewsNowJob(args: {
  cronId: number | null;
  params: NewsNowFetchParams;
  articlesPerRun: number;
}): Promise<PipelineOutcome> {
  const { assertPreflightOk } = await import("@/lib/queries/preflight");
  await assertPreflightOk();
  const log: string[] = [];
  await fetchAndStageNewsNow({
    cronId: args.cronId,
    params: { ...args.params, limit: Math.max(args.articlesPerRun, 5) },
    log,
  });
  return processPendingDrafts({ limit: args.articlesPerRun, log });
}
