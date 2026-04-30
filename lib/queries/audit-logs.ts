import "server-only";
import { sql } from "@/lib/db";

export type AuditLogRow = {
  LogID: number;
  UserName: string | null;
  FK_UserID: number | null;
  Action: string;
  Area: string;
  CreatedAt: Date;
};

export async function listAuditLogs(opts: {
  limit?: number;
  offset?: number;
  area?: string | null;
}): Promise<AuditLogRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const area = opts.area ?? null;

  if (area) {
    return sql<AuditLogRow[]>`
      SELECT "LogID", "UserName", "FK_UserID", "Action", "Area", "CreatedAt"
      FROM "AuditLogs"
      WHERE "Area" = ${area}
      ORDER BY "CreatedAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return sql<AuditLogRow[]>`
    SELECT "LogID", "UserName", "FK_UserID", "Action", "Area", "CreatedAt"
    FROM "AuditLogs"
    ORDER BY "CreatedAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function countAuditLogs(area?: string | null): Promise<number> {
  if (area) {
    const r = await sql<{ c: string }[]>`
      SELECT COUNT(*)::text AS c FROM "AuditLogs" WHERE "Area" = ${area}
    `;
    return Number(r[0]?.c ?? 0);
  }
  const r = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c FROM "AuditLogs"
  `;
  return Number(r[0]?.c ?? 0);
}

export async function listAuditAreas(): Promise<string[]> {
  const rows = await sql<{ Area: string }[]>`
    SELECT DISTINCT "Area" FROM "AuditLogs" ORDER BY "Area" ASC
  `;
  return rows.map((r) => r.Area);
}
