import "server-only";
import { sql } from "@/lib/db";
import type { ArticleDraft, ArticleDraftStatus } from "@/lib/types";

const COLS = sql`
  "DraftID"::text AS "DraftID",
  "FK_CronID", "FK_CatID",
  "Title", "Summary", "Keywords", "ImagePrompt", "Slug", "TrendQuery",
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
  /** Router mode: per-idea category override. Falls back to defaultCatId. */
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
    RETURNING ${COLS}
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

/** For the meta-AI's "what have we already published / queued" hint. */
export async function recentTitlesForCategory(
  catId: number,
  limit = 200,
): Promise<string[]> {
  const fromContents = await sql<{ Title: string }[]>`
    SELECT "ContentTitle" AS "Title" FROM "Contents"
    WHERE "FK_CatID" = ${catId} AND "IsDeleted" = FALSE
    ORDER BY "CreatedDate" DESC
    LIMIT ${limit}
  `;
  const fromDrafts = await sql<{ Title: string }[]>`
    SELECT "Title" FROM "ArticleDrafts"
    WHERE "FK_CatID" = ${catId} AND "Status" IN ('pending','processing','done')
    ORDER BY "CreatedAt" DESC
    LIMIT ${limit}
  `;
  return [...fromContents, ...fromDrafts].map((r) => r.Title).filter(Boolean);
}

/** Router-mode dedupe hint: recent titles for a SET of categories at once,
 *  capped per category so the prompt stays compact. */
export async function recentTitlesForCategoryMap(
  catIds: number[],
  perCategoryLimit = 30,
): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (catIds.length === 0) return out;
  for (const id of catIds) out.set(id, []);

  const cap = Math.max(5, Math.min(100, perCategoryLimit));
  const rows = await sql<{ FK_CatID: number; Title: string }[]>`
    SELECT "FK_CatID", "Title"
    FROM (
      SELECT "FK_CatID", "ContentTitle" AS "Title", "CreatedDate" AS "ts",
             ROW_NUMBER() OVER (PARTITION BY "FK_CatID" ORDER BY "CreatedDate" DESC) AS rn
      FROM "Contents"
      WHERE "FK_CatID" = ANY(${catIds}) AND "IsDeleted" = FALSE
      UNION ALL
      SELECT "FK_CatID", "Title", "CreatedAt" AS "ts",
             ROW_NUMBER() OVER (PARTITION BY "FK_CatID" ORDER BY "CreatedAt" DESC) AS rn
      FROM "ArticleDrafts"
      WHERE "FK_CatID" = ANY(${catIds}) AND "Status" IN ('pending','processing','done')
    ) t
    WHERE rn <= ${cap}
    ORDER BY "FK_CatID", "ts" DESC
  `;
  for (const r of rows) {
    if (!r.Title) continue;
    const list = out.get(r.FK_CatID);
    if (!list) continue;
    if (list.length < cap) list.push(r.Title);
  }
  return out;
}
