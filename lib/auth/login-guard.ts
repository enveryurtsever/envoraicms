import "server-only";
import { headers } from "next/headers";
import { sql } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS = 5;

// Returns the real client IP, trusted against header spoofing. We assume the
// app sits behind a single reverse proxy (eg. nginx with X-Real-IP +
// $proxy_add_x_forwarded_for set, as in deploy/nginx.conf). The proxy
// overwrites X-Real-IP with the TCP peer, which a client cannot forge; XFF
// on the other hand may carry a forged prefix appended by the client. So we
// prefer X-Real-IP, and fall back to the *last* hop of XFF (the one the
// proxy itself wrote) before giving up.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return "unknown";
}

export async function recordLoginAttempt(
  ip: string,
  email: string | null,
  success: boolean,
): Promise<void> {
  await sql`
    INSERT INTO "LoginAttempts" ("IP", "Email", "Success")
    VALUES (${ip}, ${email}, ${success})
  `;
}

export type LockState =
  | { locked: false }
  | { locked: true; retryAfterSec: number };

export async function isIpLocked(ip: string): Promise<LockState> {
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await sql<{ fails: number; oldest: Date | null }[]>`
    SELECT
      COUNT(*) FILTER (WHERE "Success" = FALSE)::int AS fails,
      MIN("CreatedDate") FILTER (WHERE "Success" = FALSE) AS oldest
    FROM "LoginAttempts"
    WHERE "IP" = ${ip} AND "CreatedDate" >= ${since}
  `;
  const fails = rows[0]?.fails ?? 0;
  if (fails < MAX_FAILS) return { locked: false };
  const oldest = rows[0]?.oldest ?? since;
  const unlockAt = oldest.getTime() + WINDOW_MS;
  const retryAfterSec = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
  return { locked: true, retryAfterSec };
}
