import "server-only";
import { cache } from "react";
import { sql } from "@/lib/db";
import { hasDbConfig } from "@/lib/db-config";

// 'Is install complete?' check. Does Users exist and is there at least one active admin?
// Per-request React cache so the same render doesn't re-check repeatedly.

export const isInstalled = cache(async (): Promise<boolean> => {
  if (!hasDbConfig()) return false;
  try {
    const rows = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c
      FROM "Users"
      WHERE "Role" = 'admin' AND "IsActive" = TRUE AND "IsDeleted" = FALSE
    `;
    return (rows[0]?.c ?? 0) > 0;
  } catch {
    // Table missing or no connection → not installed
    return false;
  }
});

export async function assertNotInstalled(): Promise<void> {
  if (await isInstalled()) {
    throw new Error("INSTALLED");
  }
}
