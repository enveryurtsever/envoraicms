import "server-only";
import { cache } from "react";
import { sql } from "@/lib/db";
import { hasDbConfig } from "@/lib/db-config";

// 'Is install complete?' check. Does Users exist and is there at least one active admin?
// Per-request React cache so the same render doesn't re-check repeatedly.

// Postgres "undefined_table" — the schema genuinely isn't there yet.
function isUndefinedTable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (code === "42P01") return true;
  const msg = (err as { message?: string } | null)?.message ?? "";
  return /relation .* does not exist/i.test(msg);
}

export const isInstalled = cache(async (): Promise<boolean> => {
  if (!hasDbConfig()) return false;
  try {
    const rows = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c
      FROM "Users"
      WHERE "Role" = 'admin' AND "IsActive" = TRUE AND "IsDeleted" = FALSE
    `;
    return (rows[0]?.c ?? 0) > 0;
  } catch (err) {
    // Only a missing schema means "not installed". A transient DB hiccup
    // (timeout, dropped connection, pool exhaustion) must NOT bounce a live
    // site to the install wizard — that was the "content disappears on
    // refresh" symptom. Assume installed and let cached queries serve what
    // they can.
    if (isUndefinedTable(err)) return false;
    console.error("[isInstalled] DB check failed (treating as installed):", err);
    return true;
  }
});

export async function assertNotInstalled(): Promise<void> {
  if (await isInstalled()) {
    throw new Error("INSTALLED");
  }
}
