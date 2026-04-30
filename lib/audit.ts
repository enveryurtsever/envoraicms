import "server-only";
import { revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// Simple audit log. Called fire-and-forget on admin actions;
// never throws so it can't break the underlying action.
export async function logAudit(area: string, action: string): Promise<void> {
  try {
    const sess = await getSession();
    const name = sess?.displayName ?? sess?.email ?? "system";
    await sql`
      INSERT INTO "AuditLogs" ("UserName", "FK_UserID", "Action", "Area")
      VALUES (${name}, ${sess?.uid ?? null}, ${action}, ${area})
    `;
    // Bump audit-logs cache so the dashboard's "recent activity" tile and any
    // cached audit listings reflect the new entry on next read.
    revalidateTag("audit-logs");
  } catch {
    // Swallow — a logging infrastructure failure must not break the caller.
  }
}
