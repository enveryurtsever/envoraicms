"use server";

import { revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { parseServiceAccount } from "@/lib/indexing/google";
import { submitIndexingForContent, buildContentUrl } from "@/lib/indexing/submit";

function str(fd: FormData, k: string, max = 20000): string {
  const v = fd.get(k);
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function saveIndexingAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);

  const enabled = fd.get("IndexingEnabled") === "on";
  const saJsonRaw = str(fd, "IndexingServiceAccountJSON", 20000);

  if (saJsonRaw) {
    try {
      parseServiceAccount(saJsonRaw);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Invalid service account JSON.");
    }
  }

  const existing = await sql<{ SettingsID: number }[]>`
    SELECT "SettingsID" FROM "Settings" WHERE "IsDeleted" = FALSE
    ORDER BY "SettingsID" ASC LIMIT 1
  `;
  if (existing.length > 0) {
    await sql`
      UPDATE "Settings"
         SET "IndexingEnabled" = ${enabled},
             "IndexingServiceAccountJSON" = ${saJsonRaw || null}
       WHERE "SettingsID" = ${existing[0].SettingsID}
    `;
  }

  revalidateTag("settings");
}

export async function submitManualAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const contentId = Number(fd.get("contentId"));
  const slug = str(fd, "slug", 200);
  const type = (fd.get("type") === "URL_DELETED" ? "URL_DELETED" : "URL_UPDATED") as
    | "URL_UPDATED"
    | "URL_DELETED";
  if (!slug || !Number.isFinite(contentId)) {
    throw new Error("Content ID and slug are required.");
  }
  const url = await buildContentUrl(slug);
  const r = await submitIndexingForContent(contentId, url, type);
  if (!r.ok) {
    throw new Error(r.message ?? "Submission failed.");
  }
}
