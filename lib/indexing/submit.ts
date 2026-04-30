import "server-only";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/queries/settings";
import {
  parseServiceAccount,
  publishUrl,
  type NotifyType,
  type PublishResult,
} from "./google";

// Notifies Google Indexing API of a content URL and records the result in IndexingLog.
// For fire-and-forget callers, top-level exceptions are swallowed; the log lands in the DB.

export async function submitIndexingForContent(
  contentId: number,
  url: string,
  type: NotifyType,
): Promise<PublishResult> {
  const settings = await getSettings();
  if (!settings.IndexingEnabled) {
    return { ok: false, httpStatus: 0, message: "indexing_disabled" };
  }
  if (!settings.IndexingServiceAccountJSON) {
    return { ok: false, httpStatus: 0, message: "no_service_account" };
  }

  let result: PublishResult;
  try {
    const sa = parseServiceAccount(settings.IndexingServiceAccountJSON);
    result = await publishUrl(sa, url, type);
  } catch (err) {
    result = {
      ok: false,
      httpStatus: 0,
      message: err instanceof Error ? err.message : "unknown",
    };
  }

  try {
    await sql`
      INSERT INTO "IndexingLog"
        ("FK_ContentID", "Url", "Type", "Status", "HttpStatus", "Message")
      VALUES
        (${contentId}, ${url}, ${type},
         ${result.ok ? "ok" : "error"}, ${result.httpStatus},
         ${result.message ?? null})
    `;
  } catch {
    // A logging failure must not affect the publish result.
  }

  return result;
}

export function submitIndexingFireAndForget(
  contentId: number,
  url: string,
  type: NotifyType,
): void {
  // Non-blocking: don't make the admin action wait on this.
  void submitIndexingForContent(contentId, url, type).catch(() => {
    /* swallow; the failure is already logged to the DB */
  });
}

export async function buildContentUrl(slug: string): Promise<string> {
  const settings = await getSettings();
  const base = (settings.SiteUrl ?? "").replace(/\/+$/, "");
  if (!base) return `/s/${slug}`;
  return `${base}/s/${slug}`;
}
