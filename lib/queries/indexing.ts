import "server-only";
import { sql } from "@/lib/db";

export type IndexingLogRow = {
  LogID: number;
  FK_ContentID: number | null;
  Url: string;
  Type: "URL_UPDATED" | "URL_DELETED";
  Status: "ok" | "error";
  HttpStatus: number | null;
  Message: string | null;
  SubmittedAt: Date;
};

export async function listRecentIndexingLog(limit = 50): Promise<IndexingLogRow[]> {
  return sql<IndexingLogRow[]>`
    SELECT "LogID", "FK_ContentID", "Url", "Type", "Status",
           "HttpStatus", "Message", "SubmittedAt"
    FROM "IndexingLog"
    ORDER BY "SubmittedAt" DESC
    LIMIT ${limit}
  `;
}

export async function countIndexingLog24h(): Promise<{ ok: number; error: number }> {
  const rows = await sql<{ status: string; c: number }[]>`
    SELECT "Status" AS status, COUNT(*)::int AS c
    FROM "IndexingLog"
    WHERE "SubmittedAt" >= NOW() - INTERVAL '24 hours'
    GROUP BY "Status"
  `;
  const out = { ok: 0, error: 0 };
  for (const r of rows) {
    if (r.status === "ok") out.ok = r.c;
    else if (r.status === "error") out.error = r.c;
  }
  return out;
}
