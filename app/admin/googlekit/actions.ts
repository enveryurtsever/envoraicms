"use server";

import { revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

export async function saveGoogleKit(fd: FormData): Promise<void> {
  await requireRole(["admin"]);

  const data = {
    GoogleAnalyticsID: str(fd, "GoogleAnalyticsID"),
    GoogleTagManagerID: str(fd, "GoogleTagManagerID"),
    SearchConsoleMeta: str(fd, "SearchConsoleMeta"),
    AdsensePublisherID: str(fd, "AdsensePublisherID"),
    AdsenseAutoAds: bool(fd, "AdsenseAutoAds"),
    AdsenseExtraHead: str(fd, "AdsenseExtraHead"),
  };

  const existing = await sql<{ SettingsID: number }[]>`
    SELECT "SettingsID" FROM "Settings" WHERE "IsDeleted" = FALSE
    ORDER BY "SettingsID" ASC LIMIT 1
  `;

  if (existing.length === 0) {
    await sql`
      INSERT INTO "Settings" (
        "GoogleAnalyticsID","GoogleTagManagerID","SearchConsoleMeta",
        "AdsensePublisherID","AdsenseAutoAds","AdsenseExtraHead",
        "FK_LangID","CreatedDate"
      ) VALUES (
        ${data.GoogleAnalyticsID}, ${data.GoogleTagManagerID}, ${data.SearchConsoleMeta},
        ${data.AdsensePublisherID}, ${data.AdsenseAutoAds}, ${data.AdsenseExtraHead},
        1, NOW()
      )
    `;
  } else {
    await sql`
      UPDATE "Settings" SET
        "GoogleAnalyticsID"   = ${data.GoogleAnalyticsID},
        "GoogleTagManagerID"  = ${data.GoogleTagManagerID},
        "SearchConsoleMeta"   = ${data.SearchConsoleMeta},
        "AdsensePublisherID"  = ${data.AdsensePublisherID},
        "AdsenseAutoAds"      = ${data.AdsenseAutoAds},
        "AdsenseExtraHead"    = ${data.AdsenseExtraHead}
      WHERE "SettingsID" = ${existing[0].SettingsID}
    `;
  }

  revalidateTag("settings");
  await logAudit("googlekit", "Google Kit settings updated");
}
