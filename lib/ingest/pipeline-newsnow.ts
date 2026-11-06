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
import { makeFalaiProvider } from "./providers/image/falai";
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
import { evaluateForPublish } from "./gate";
import { isFreshSource, MAX_SOURCE_AGE_DAYS } from "./gate/checks";
import { resolveSource } from "./gate/sources";
import { buildContentUrl, submitIndexingFireAndForget } from "@/lib/indexing/submit";

const PROVIDER = "newsnow";

const cronImageProviderCache = new Map<number, "passthrough" | "falai">();

async function getImageProviderForCron(cronId: number): Promise<"passthrough" | "falai"> {
  if (cronImageProviderCache.has(cronId)) {
    return cronImageProviderCache.get(cronId)!;
  }
  const rows = await sql<{ ImageAiProvider: string | null }[]>`
    SELECT "ImageAiProvider" FROM "CronJobs" WHERE "CronID" = ${cronId} LIMIT 1
  `;
  const provider = rows[0]?.ImageAiProvider === "falai" ? "falai" : "passthrough";
  cronImageProviderCache.set(cronId, provider);
  return provider;
}

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
  pickAuthor: import("@/lib/queries/authors").AuthorPicker;
}): Promise<number> {
  const { cat, draft, rewritten, imagePath, publisherName, staggerMinutes, pickAuthor } = args;
  const slug = await ensureUniqueSlug(rewritten.slug);
  const source = publisherName
    ? JSON.stringify({ title: publisherName, href: draft.SourceUrl ?? "" })
    : null;
  const homepage = rewritten.importance >= 7;
  const author = pickAuthor(cat.CatID);
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
 * site category, generate/download image per imageProvider, insert a Contents row,
 * and mark the draft done. Errors are recorded on the draft so they can be retried.
 */
export async function processPendingDrafts(args: {
  limit: number;
  imageProvider?: "passthrough" | "falai";
  log: string[];
}): Promise<PipelineOutcome> {
  const { limit, log } = args;
  const result: PipelineOutcome = { inserted: 0, skipped: 0, errored: 0, log };

  const { buildAuthorPicker } = await import("@/lib/queries/authors");
  const [categories, pickAuthor] = await Promise.all([
    loadActiveCategories(),
    buildAuthorPicker(),
  ]);
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

      if (!isFreshSource(article.date)) {
        const reason = `Source is older than ${MAX_SOURCE_AGE_DAYS} days.`;
        await markSkipped(draft.DraftID, reason);
        log.push(`[draft#${draft.DraftID}] skipped: ${reason}`);
        result.skipped += 1;
        continue;
      }

      log.push(`[draft#${draft.DraftID}] rewriting "${article.title?.slice(0, 70) ?? ""}"`);
      const source = await resolveSource({
        url: article.url ?? draft.SourceUrl,
        title: article.title,
        publisher: article.publisher?.name,
        suppliedText: [article.excerpt, article.short_description as string | null | undefined, article.text],
        publishedAt: article.date,
      });
      const rewritten = await rewriteWithCategory({
        article: source ? { ...article, text: source.text } : article,
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

      // Checked before image generation so a rejected article costs no image.
      const gate = await evaluateForPublish({
        title: rewritten.title,
        detail: rewritten.detail,
        keywords: rewritten.keywords,
        categoryName: cat.CatName,
        sources: source ? [source] : [],
      });
      if (gate.status === "rejected") {
        const reason = gate.reasons.join("; ");
        await markSkipped(draft.DraftID, reason);
        log.push(`[draft#${draft.DraftID}] skipped: ${reason}`);
        result.skipped += 1;
        continue;
      }
      rewritten.title = gate.title;
      rewritten.detail = gate.detail;

      // Handle image generation based on selected Image Generator setting
      let effectiveProvider = args.imageProvider;
      if (!effectiveProvider && draft.FK_CronID) {
        effectiveProvider = await getImageProviderForCron(draft.FK_CronID);
      }
      if (!effectiveProvider) {
        effectiveProvider = "passthrough";
      }

      let imagePath = draft.TopImage ?? "";
      if (effectiveProvider === "falai") {
        try {
          const provider = await makeFalaiProvider();
          const promptForImage =
            rewritten.imagePrompt?.trim() ||
            `${rewritten.title}. Editorial news photograph, photojournalistic style, high quality, no text, no logos.`;
          imagePath = await provider.generate({
            prompt: promptForImage,
            slug: rewritten.slug,
            fallbackThumbnail: draft.TopImage ?? null,
          });
          log.push(`[draft#${draft.DraftID}] [falai] generated image`);
        } catch (err) {
          log.push(
            `[draft#${draft.DraftID}] fal.ai image generation failed: ${
              err instanceof Error ? err.message : String(err)
            } (falling back to original thumbnail)`,
          );
          if (draft.TopImage) {
            try {
              imagePath = await downloadAndStoreImage({
                url: draft.TopImage,
                bucket: "content",
                slug: rewritten.slug,
              });
            } catch (dlErr) {
              log.push(
                `[draft#${draft.DraftID}] image download failed: ${
                  dlErr instanceof Error ? dlErr.message : String(dlErr)
                } (keeping original URL)`,
              );
            }
          }
        }
      } else if (draft.TopImage) {
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

      const stagger = result.inserted * 15;
      const contentId = await insertContentFromDraft({
        cat,
        draft,
        rewritten,
        imagePath,
        publisherName,
        staggerMinutes: stagger,
        pickAuthor,
      });
      const url = await buildContentUrl(cat.CatSeo, rewritten.slug);
      submitIndexingFireAndForget(contentId, url, "URL_UPDATED");
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

/** End-to-end run for one cron job: fetch + immediately process up to N.
 *  Pass `log` to capture progress so the caller can persist it on failure. */
export async function runNewsNowJob(args: {
  cronId: number | null;
  params: NewsNowFetchParams;
  articlesPerRun: number;
  imageProvider?: "passthrough" | "falai";
  log?: string[];
}): Promise<PipelineOutcome> {
  const { assertPreflightOk } = await import("@/lib/queries/preflight");
  await assertPreflightOk();
  const log = args.log ?? [];
  await fetchAndStageNewsNow({
    cronId: args.cronId,
    params: { ...args.params, limit: Math.max(args.articlesPerRun, 5) },
    log,
  });
  return processPendingDrafts({
    limit: args.articlesPerRun,
    imageProvider: args.imageProvider,
    log,
  });
}

