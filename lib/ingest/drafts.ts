import "server-only";
import { sql } from "@/lib/db";
import type { NewsNowArticle } from "@/lib/ingest/types";

export type DraftStatus = "pending" | "processing" | "done" | "skipped" | "error";

export type Draft = {
  DraftID: string; // bigint as string from postgres
  Provider: string;
  ExternalID: string | null;
  RawJSON: NewsNowArticle;
  TopImage: string | null;
  SourceTitle: string | null;
  SourceUrl: string | null;
  Status: DraftStatus;
  FK_CronID: number | null;
  FK_CatID: number | null;
  FK_ContentID: number | null;
  Message: string | null;
  FetchedAt: string;
  ProcessedAt: string | null;
};

const COLS = sql`
  "DraftID"::text AS "DraftID",
  "Provider", "ExternalID",
  "RawJSON", "TopImage", "SourceTitle", "SourceUrl",
  "Status", "FK_CronID", "FK_CatID", "FK_ContentID",
  "Message",
  "FetchedAt"::text AS "FetchedAt",
  "ProcessedAt"::text AS "ProcessedAt"
`;

/** Insert (or skip on conflict) a fetched article. Returns the draft id when
 *  a new row was inserted, null when it was a duplicate. */
export async function saveDraft(args: {
  provider: string;
  externalId: string | null;
  raw: NewsNowArticle;
  cronId: number | null;
}): Promise<string | null> {
  const { provider, externalId, raw, cronId } = args;
  const topImage = raw.top_image ?? null;
  const sourceTitle = raw.publisher?.name ?? null;
  const sourceUrl = raw.url ?? null;
  const rows = await sql<{ DraftID: string }[]>`
    INSERT INTO "NewsApiDrafts"
      ("Provider","ExternalID","RawJSON","TopImage",
       "SourceTitle","SourceUrl","FK_CronID","Status")
    VALUES
      (${provider}, ${externalId},
       ${sql.json(raw as never)},
       ${topImage}, ${sourceTitle}, ${sourceUrl}, ${cronId}, 'pending')
    ON CONFLICT ("Provider", "ExternalID") WHERE "ExternalID" IS NOT NULL DO NOTHING
    RETURNING "DraftID"::text AS "DraftID"
  `;
  return rows[0]?.DraftID ?? null;
}

export async function listDraftsByStatus(
  status: DraftStatus,
  limit = 50,
): Promise<Draft[]> {
  return sql<Draft[]>`
    SELECT ${COLS} FROM "NewsApiDrafts"
    WHERE "Status" = ${status}
    ORDER BY "FetchedAt" ASC
    LIMIT ${limit}
  `;
}

export async function listRecentDrafts(
  limit = 50,
  offset = 0,
): Promise<Draft[]> {
  return sql<Draft[]>`
    SELECT ${COLS} FROM "NewsApiDrafts"
    ORDER BY "FetchedAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function countAllDrafts(): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "NewsApiDrafts"
  `;
  return rows[0]?.c ?? 0;
}

export async function getDraft(id: string | number): Promise<Draft | null> {
  const rows = await sql<Draft[]>`
    SELECT ${COLS} FROM "NewsApiDrafts" WHERE "DraftID" = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Atomically claim a pending draft for processing (avoid double-pickup). */
export async function claimDraft(id: string | number): Promise<Draft | null> {
  const rows = await sql<Draft[]>`
    UPDATE "NewsApiDrafts"
       SET "Status" = 'processing'
     WHERE "DraftID" = ${id} AND "Status" = 'pending'
    RETURNING ${COLS}
  `;
  return rows[0] ?? null;
}

export async function markDone(args: {
  id: string | number;
  catId: number;
  contentId: number;
}): Promise<void> {
  await sql`
    UPDATE "NewsApiDrafts"
       SET "Status" = 'done',
           "FK_CatID" = ${args.catId},
           "FK_ContentID" = ${args.contentId},
           "ProcessedAt" = NOW(),
           "Message" = NULL
     WHERE "DraftID" = ${args.id}
  `;
}

export async function markSkipped(id: string | number, reason: string): Promise<void> {
  await sql`
    UPDATE "NewsApiDrafts"
       SET "Status" = 'skipped',
           "ProcessedAt" = NOW(),
           "Message" = ${reason}
     WHERE "DraftID" = ${id}
  `;
}

export async function markError(id: string | number, message: string): Promise<void> {
  await sql`
    UPDATE "NewsApiDrafts"
       SET "Status" = 'error',
           "ProcessedAt" = NOW(),
           "Message" = ${message.slice(0, 500)}
     WHERE "DraftID" = ${id}
  `;
}

export async function resetDraftToPending(id: string | number): Promise<void> {
  await sql`
    UPDATE "NewsApiDrafts"
       SET "Status" = 'pending',
           "ProcessedAt" = NULL,
           "Message" = NULL,
           "FK_ContentID" = NULL,
           "FK_CatID" = NULL
     WHERE "DraftID" = ${id}
  `;
}

export async function deleteDraft(id: string | number): Promise<void> {
  await sql`DELETE FROM "NewsApiDrafts" WHERE "DraftID" = ${id}`;
}

export async function countDraftsByStatus(): Promise<Record<DraftStatus, number>> {
  const rows = await sql<{ Status: DraftStatus; c: number }[]>`
    SELECT "Status", COUNT(*)::int AS c
      FROM "NewsApiDrafts"
     GROUP BY "Status"
  `;
  const out: Record<DraftStatus, number> = {
    pending: 0, processing: 0, done: 0, skipped: 0, error: 0,
  };
  for (const r of rows) out[r.Status] = r.c;
  return out;
}
