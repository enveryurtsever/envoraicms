import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import type { Theme } from "@/lib/types";

const BASE_COLS = sql`
  "ThemeID", "ThemeSlug", "ThemeName", "ThemeDesc", "PreviewImage",
  COALESCE("Config", '{}'::jsonb) AS "Config",
  COALESCE("SupportsDark", TRUE) AS "SupportsDark",
  COALESCE("IsActive", TRUE) AS "IsActive"
`;

const loadAll = unstable_cache(
  async (): Promise<Theme[]> =>
    sql<Theme[]>`
      SELECT ${BASE_COLS} FROM "Themes"
      WHERE "IsDeleted" = FALSE AND "IsActive" = TRUE
      ORDER BY "ThemeID" ASC
    `,
  ["themes:list"],
  { revalidate: 3600, tags: ["themes"] },
);

export const listThemes = cache(loadAll);

export const getActiveThemeSlug = cache(async (): Promise<string> => {
  const rows = await sql<{ ThemeSlug: string }[]>`
    SELECT t."ThemeSlug"
    FROM "Settings" s
    JOIN "Themes" t ON t."ThemeID" = s."FK_ThemeID"
    WHERE s."IsDeleted" = FALSE AND t."IsDeleted" = FALSE
    ORDER BY s."SettingsID" ASC
    LIMIT 1
  `;
  return rows[0]?.ThemeSlug ?? "classic";
});

export async function getThemeById(id: number): Promise<Theme | null> {
  const rows = await sql<Theme[]>`
    SELECT ${BASE_COLS} FROM "Themes"
    WHERE "ThemeID" = ${id} AND "IsDeleted" = FALSE LIMIT 1
  `;
  return rows[0] ?? null;
}
