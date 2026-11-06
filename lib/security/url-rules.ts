import { sql } from "@/lib/db";

export type UrlRule = { status: 301 | 410; target: string | null };

// Retired article URLs are few and rarely change, so each worker keeps them in
// memory and refreshes in the background. Page requests never wait on the DB.
const REFRESH_MS = 30_000;

let rules = new Map<string, UrlRule>();
let refreshedAt = 0;
let refreshing = false;

function refreshInBackground() {
  if (refreshing || Date.now() - refreshedAt < REFRESH_MS) return;
  refreshing = true;
  refreshedAt = Date.now();
  void Promise.resolve()
    .then(() => sql<{ Path: string; Status: number; Target: string | null }[]>`
      SELECT "Path", "Status", "Target" FROM "UrlRules"
    `)
    .then((rows) => {
      rules = new Map(
        rows.map((row) => [row.Path, { status: row.Status as 301 | 410, target: row.Target }]),
      );
    })
    // Before install, or with the DB down, keep the rules we have.
    .catch(() => undefined)
    .finally(() => {
      refreshing = false;
    });
}

export function matchUrlRule(pathname: string): UrlRule | null {
  refreshInBackground();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return rules.get(path) ?? null;
}
