"use server";

import { revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

/** Switches the active site theme by slug. The Settings table holds an
 *  FK_ThemeID; we resolve the slug → id and write through. */
export async function setActiveThemeAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing theme slug.");

  const rows = await sql<{ ThemeID: number; ThemeName: string }[]>`
    SELECT "ThemeID", "ThemeName" FROM "Themes"
    WHERE "ThemeSlug" = ${slug} AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  const theme = rows[0];
  if (!theme) throw new Error(`Unknown theme: ${slug}`);

  await sql`
    UPDATE "Settings"
    SET "FK_ThemeID" = ${theme.ThemeID}
    WHERE "SettingsID" = (
      SELECT "SettingsID" FROM "Settings"
      WHERE "IsDeleted" = FALSE
      ORDER BY "SettingsID" ASC LIMIT 1
    )
  `;

  await logAudit("themes", `active theme set to "${theme.ThemeName}" (${slug})`);
  revalidateTag("settings");
  revalidateTag("themes");
}
