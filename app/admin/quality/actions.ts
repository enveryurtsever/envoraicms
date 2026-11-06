"use server";

import { revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { buildContentUrl, submitIndexingFireAndForget } from "@/lib/indexing/submit";
import {
  retireArticle,
  retireDuplicateUrls,
  type RetiredArticle,
} from "@/lib/queries/archive";

function text(fd: FormData, key: string): string | null {
  const value = fd.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function saveQualitySettings(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const windowDays = Math.max(1, Math.min(365, Number(fd.get("DuplicateWindowDays")) || 60));
  await sql`
    UPDATE "Settings" SET
      "ReviewGateEnabled"   = ${fd.get("ReviewGateEnabled") === "on"},
      "DuplicateWindowDays" = ${windowDays},
      "PublisherName"       = ${text(fd, "PublisherName")},
      "ContactEmail"        = ${text(fd, "ContactEmail")},
      "EuConsentEnabled"    = ${fd.get("EuConsentEnabled") === "on"}
    WHERE "IsDeleted" = FALSE
  `;
  revalidateTag("settings");
  await logAudit("quality", "Content quality settings updated");
}

// A local path, or a full URL on any site: "//evil.com" is neither.
function validTarget(raw: string | null): string {
  if (raw && /^\/(?!\/)/.test(raw)) return raw;
  if (raw && /^https?:\/\/[^/\s]+/i.test(raw)) return raw;
  throw new Error("Enter a target such as /category/article-slug.");
}

async function afterRetire(retired: RetiredArticle[], summary: string): Promise<void> {
  revalidateTag("contents");
  await logAudit("quality", summary);
  for (const article of retired) {
    const [, category, slug] = article.path.split("/");
    const url = await buildContentUrl(category!, slug!);
    submitIndexingFireAndForget(article.id, url, "URL_DELETED");
  }
}

export async function redirectArticleAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const target = validTarget(text(fd, "target"));
  const retired = await retireArticle(Number(fd.get("id")), { status: 301, target });
  if (retired) await afterRetire([retired], `301: ${retired.path} -> ${target}`);
}

export async function removeArticleAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const retired = await retireArticle(Number(fd.get("id")), { status: 410 });
  if (retired) await afterRetire([retired], `410: ${retired.path}`);
}

export async function redirectAllDuplicatesAction(): Promise<void> {
  await requireRole(["admin"]);
  const retired = await retireDuplicateUrls();
  await afterRetire(retired, `301: redirected ${retired.length} duplicate URLs to their originals`);
}
