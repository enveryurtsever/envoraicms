import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import type { Category } from "@/lib/types";

const BASE_COLS = sql`
  "CatID", "FK_LangID", "CatName", "CatTitle", "CatKeywords", "CatDesc",
  "CatURL", "CatSeo", "CatImage", "CatNumber", "HeaderMenu", "FooterMenu",
  "SideMenu", "DropdownMenu", "IsActive", "ParentCatID"
`;

const loadAll = unstable_cache(
  async (): Promise<Category[]> =>
    sql<Category[]>`
      SELECT ${BASE_COLS}
      FROM "Categories"
      WHERE "IsActive" = true
        AND "IsDeleted" = false
        AND "HeaderMenu" = true
      ORDER BY "CatNumber" ASC, "CatID" ASC
    `,
  ["categories:header"],
  { revalidate: 3600, tags: ["categories"] }
);

export const getHeaderCategories = cache(loadAll);

const loadBySlug = unstable_cache(
  async (slug: string): Promise<Category | null> => {
    const rows = await sql<Category[]>`
      SELECT ${BASE_COLS}
      FROM "Categories"
      WHERE "CatSeo" = ${slug}
        AND "IsActive" = true
        AND "IsDeleted" = false
      LIMIT 1
    `;
    return rows[0] ?? null;
  },
  ["category:by-slug"],
  { revalidate: 3600, tags: ["categories"] }
);

export const getCategoryBySlug = cache((slug: string) => loadBySlug(slug));

export const getAllCategorySlugs = cache(async (): Promise<string[]> => {
  const rows = await sql<{ CatSeo: string }[]>`
    SELECT "CatSeo"
    FROM "Categories"
    WHERE "IsActive" = true AND "IsDeleted" = false AND "CatSeo" IS NOT NULL
  `;
  return rows.map((r) => r.CatSeo).filter(Boolean);
});
