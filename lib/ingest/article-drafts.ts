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
};

/** Bulk insert ideated drafts. Title duplicates within the same category are
 *  silently skipped (handled by the unique partial index on
 *  (FK_CatID, LOWER(Title))). Returns how many rows were actually inserted. */
export async function saveDraftBatch(args: {
  cronId: number | null;
  catId: number;
  creatorId: number | null;
  ideas: ArticleIdea[];
}): Promise<{ inserted: number; duplicates: number }> {
  const { cronId, catId, creatorId, ideas } = args;
  let inserted = 0;
  let duplicates = 0;
  for (const idea of ideas) {
    const title = idea.title.trim();
    if (!title) {
      duplicates += 1;
      continue;
    }
    const rows = await sql<{ DraftID: string }[]>`
      INSERT INTO "ArticleDrafts"
        ("FK_CronID","FK_CatID","Title","Summary","Keywords","ImagePrompt",
         "Slug","TrendQuery","Status","Fk_UserID")
      VALUES
        (${cronId}, ${catId},
         ${title},
         ${idea.summary ?? null},
         ${idea.keywords ?? null},
         ${idea.imagePrompt ?? null},
         ${idea.slug ?? null},
         ${idea.trendQuery ?? null},
         'pending',
         ${creatorId})
      ON CONFLICT DO NOTHING
      RETURNING "DraftID"::text AS "DraftID"
    `;
    if (rows.length > 0) inserted += 1;
    else duplicates += 1;
  }
  return { inserted, duplicates };
}

export async function listRecentArticleDrafts(limit = 100): Promise<ArticleDraft[]> {
  return sql<ArticleDraft[]>`
    SELECT ${COLS} FROM "ArticleDrafts"
    ORDER BY "CreatedAt" DESC
    LIMIT ${limit}
  `;
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
