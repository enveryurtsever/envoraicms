import "server-only";
import { sql } from "@/lib/db";
import type { ArticleDraft, ArticleDraftStatus } from "@/lib/types";
import type { GateSource } from "./gate";

// SourceText is large and only the writer needs it (see claimArticleDraft).
const COLS = sql`
  "DraftID"::text AS "DraftID",
  "FK_CronID", "FK_CatID",
  "Title", "Summary", "Keywords", "ImagePrompt", "Slug", "TrendQuery",
  "SeedQuery", "TrendType", "SourceUrl", "SourceTitle", "SourcePublisher", "SourcePublishedAt",
  "Status", "FK_ContentID", "Message",
  "CreatedAt"::text  AS "CreatedAt",
  "ProcessedAt"::text AS "ProcessedAt",
  "Fk_UserID"
`;

export type ArticleIdea = {
  title: string;
  summary?: string | null;
  keywords?: string | null;
  imagePrompt?: string | null;
  slug?: string | null;
  trendQuery?: string | null;
  seedQuery?: string | null;
  trendType?: string | null;
  source?: GateSource | null;
  /** Per-idea category override. Falls back to defaultCatId. */
  catId?: number | null;
};

/** Bulk insert ideated drafts. Each idea may carry its own `catId` (router
 *  mode); ideas without one fall back to `defaultCatId`. Title duplicates
 *  within the same category are silently skipped (handled by the unique
 *  partial index on (FK_CatID, LOWER(Title))). */
export async function saveDraftBatch(args: {
  cronId: number | null;
  defaultCatId: number | null;
  creatorId: number | null;
  ideas: ArticleIdea[];
}): Promise<{ inserted: number; duplicates: number }> {
  const { cronId, defaultCatId, creatorId, ideas } = args;

  const rows = ideas
    .map((idea) => {
      const title = idea.title.trim();
      const catId = idea.catId ?? defaultCatId;
      if (!title || !catId) return null;
      return {
        FK_CronID: cronId,
        FK_CatID: catId,
        Title: title,
        Summary: idea.summary ?? null,
        Keywords: idea.keywords ?? null,
        ImagePrompt: idea.imagePrompt ?? null,
        Slug: idea.slug ?? null,
        TrendQuery: idea.trendQuery ?? null,
        SeedQuery: idea.seedQuery ?? null,
        TrendType: idea.trendType ?? null,
        SourceUrl: idea.source?.url ?? null,
        SourceTitle: idea.source?.title ?? null,
        SourcePublisher: idea.source?.publisher ?? null,
        SourcePublishedAt: idea.source?.publishedAt ?? null,
        SourceText: idea.source?.text ?? null,
        Status: "pending",
        Fk_UserID: creatorId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const invalid = ideas.length - rows.length;
  if (rows.length === 0) return { inserted: 0, duplicates: invalid };

  // Single multi-row INSERT — was N round-trips for N ideas. ON CONFLICT
  // skips title dupes (idx_articledrafts_cat_title), and RETURNING gives us
  // the actual insert count regardless of dupes. Cast: the postgres-js
  // bulk-insert helper signature isn't exposed by the local sql proxy type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const helper = (sql as any)(
    rows,
    "FK_CronID",
    "FK_CatID",
    "Title",
    "Summary",
    "Keywords",
    "ImagePrompt",
    "Slug",
    "TrendQuery",
    "SeedQuery",
    "TrendType",
    "SourceUrl",
    "SourceTitle",
    "SourcePublisher",
    "SourcePublishedAt",
    "SourceText",
    "Status",
    "Fk_UserID",
  );
  const inserted = await sql<{ DraftID: string }[]>`
    INSERT INTO "ArticleDrafts" ${helper}
    ON CONFLICT DO NOTHING
    RETURNING "DraftID"::text AS "DraftID"
  `;

  return {
    inserted: inserted.length,
    duplicates: invalid + (rows.length - inserted.length),
  };
}

export async function listRecentArticleDrafts(
  limit = 100,
  offset = 0,
): Promise<ArticleDraft[]> {
  return sql<ArticleDraft[]>`
    SELECT ${COLS} FROM "ArticleDrafts"
    ORDER BY "CreatedAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function countAllArticleDrafts(): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "ArticleDrafts"
  `;
  return rows[0]?.c ?? 0;
}

export async function listPendingArticleDrafts(args: {
  cronId?: number | null;
  limit: number;
}): Promise<ArticleDraft[]> {
  if (args.cronId == null) {
    return sql<ArticleDraft[]>`
      SELECT ${COLS} FROM "ArticleDrafts"
      WHERE "Status" = 'pending'
      ORDER BY "CreatedAt" ASC
      LIMIT ${args.limit}
    `;
  }
  return sql<ArticleDraft[]>`
    SELECT ${COLS} FROM "ArticleDrafts"
    WHERE "Status" = 'pending' AND "FK_CronID" = ${args.cronId}
    ORDER BY "CreatedAt" ASC
    LIMIT ${args.limit}
  `;
}

export async function countPendingForCron(cronId: number): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "ArticleDrafts"
    WHERE "Status" = 'pending' AND "FK_CronID" = ${cronId}
  `;
  return rows[0]?.c ?? 0;
}

export async function countArticleDraftsByStatus(): Promise<Record<ArticleDraftStatus, number>> {
  const rows = await sql<{ Status: ArticleDraftStatus; c: number }[]>`
    SELECT "Status", COUNT(*)::int AS c FROM "ArticleDrafts" GROUP BY "Status"
  `;
  const out: Record<ArticleDraftStatus, number> = {
    pending: 0, processing: 0, done: 0, skipped: 0, error: 0,
  };
  for (const r of rows) out[r.Status] = r.c;
  return out;
}

/** Atomically claim a pending draft for processing. */
export async function claimArticleDraft(id: string | number): Promise<ArticleDraft | null> {
  const rows = await sql<ArticleDraft[]>`
    UPDATE "ArticleDrafts"
       SET "Status" = 'processing'
     WHERE "DraftID" = ${id} AND "Status" = 'pending'
    RETURNING ${COLS}, "SourceText"
  `;
  return rows[0] ?? null;
}

export async function markArticleDone(args: {
  id: string | number;
  contentId: number;
}): Promise<void> {
  await sql`
    UPDATE "ArticleDrafts"
       SET "Status" = 'done',
           "FK_ContentID" = ${args.contentId},
           "ProcessedAt" = NOW(),
           "Message" = NULL
     WHERE "DraftID" = ${args.id}
  `;
}

export async function markArticleSkipped(id: string | number, message: string): Promise<void> {
  await sql`
    UPDATE "ArticleDrafts"
       SET "Status" = 'skipped',
           "ProcessedAt" = NOW(),
           "Message" = ${message.slice(0, 500)}
     WHERE "DraftID" = ${id}
  `;
}

export async function markArticleError(id: string | number, message: string): Promise<void> {
  await sql`
    UPDATE "ArticleDrafts"
       SET "Status" = 'error',
           "ProcessedAt" = NOW(),
           "Message" = ${message.slice(0, 500)}
     WHERE "DraftID" = ${id}
  `;
}

export async function resetArticleDraftToPending(id: string | number): Promise<void> {
  await sql`
    UPDATE "ArticleDrafts"
       SET "Status" = 'pending',
           "ProcessedAt" = NULL,
           "Message" = NULL,
           "FK_ContentID" = NULL
     WHERE "DraftID" = ${id}
  `;
}

export async function deleteArticleDraft(id: string | number): Promise<void> {
  await sql`DELETE FROM "ArticleDrafts" WHERE "DraftID" = ${id}`;
}

export async function sourceAlreadyDrafted(url: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM "ArticleDrafts" WHERE "SourceUrl" = ${url} LIMIT 1`;
  return rows.length > 0;
}
