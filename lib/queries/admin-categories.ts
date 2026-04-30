import "server-only";
import { sql } from "@/lib/db";
import type { Category } from "@/lib/types";

const BASE_COLS = sql`
  "CatID", "FK_LangID", "CatName", "CatTitle", "CatKeywords", "CatDesc",
  "CatURL", "CatSeo", "CatImage", "CatNumber",
  COALESCE("HeaderMenu", FALSE) AS "HeaderMenu",
  COALESCE("FooterMenu", FALSE) AS "FooterMenu",
  COALESCE("SideMenu", FALSE) AS "SideMenu",
  COALESCE("DropdownMenu", FALSE) AS "DropdownMenu",
  COALESCE("IsActive", TRUE) AS "IsActive",
  COALESCE("ParentCatID", 0) AS "ParentCatID"
`;

export async function listAllCategories(): Promise<Category[]> {
  return sql<Category[]>`
    SELECT ${BASE_COLS} FROM "Categories"
    WHERE "IsDeleted" = FALSE
    ORDER BY "CatNumber" ASC NULLS LAST, "CatID" ASC
  `;
}

export async function getCategoryById(id: number): Promise<Category | null> {
  const rows = await sql<Category[]>`
    SELECT ${BASE_COLS} FROM "Categories"
    WHERE "CatID" = ${id} AND "IsDeleted" = FALSE LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createCategory(data: {
  catName: string;
  catTitle: string;
  catSeo: string;
  catDesc: string | null;
  catKeywords: string | null;
  catImage: string | null;
  catNumber: number;
  headerMenu: boolean;
  footerMenu: boolean;
  sideMenu: boolean;
  dropdownMenu: boolean;
  parentCatId: number;
  isActive: boolean;
  creatorId?: number | null;
}): Promise<number> {
  const rows = await sql<{ CatID: number }[]>`
    INSERT INTO "Categories" (
      "FK_LangID","CatName","CatTitle","CatKeywords","CatDesc",
      "CatSeo","CatImage","CatNumber",
      "HeaderMenu","FooterMenu","SideMenu","DropdownMenu",
      "IsActive","ParentCatID","Fk_UserID","CreatedDate"
    ) VALUES (
      1, ${data.catName}, ${data.catTitle}, ${data.catKeywords}, ${data.catDesc},
      ${data.catSeo}, ${data.catImage}, ${data.catNumber},
      ${data.headerMenu}, ${data.footerMenu}, ${data.sideMenu}, ${data.dropdownMenu},
      ${data.isActive}, ${data.parentCatId}, ${data.creatorId ?? null}, NOW()
    )
    RETURNING "CatID"
  `;
  return rows[0].CatID;
}

export async function updateCategory(id: number, data: {
  catName: string;
  catTitle: string;
  catSeo: string;
  catDesc: string | null;
  catKeywords: string | null;
  catImage: string | null;
  catNumber: number;
  headerMenu: boolean;
  footerMenu: boolean;
  sideMenu: boolean;
  dropdownMenu: boolean;
  parentCatId: number;
  isActive: boolean;
}): Promise<void> {
  await sql`
    UPDATE "Categories" SET
      "CatName"      = ${data.catName},
      "CatTitle"     = ${data.catTitle},
      "CatSeo"       = ${data.catSeo},
      "CatDesc"      = ${data.catDesc},
      "CatKeywords"  = ${data.catKeywords},
      "CatImage"     = ${data.catImage},
      "CatNumber"    = ${data.catNumber},
      "HeaderMenu"   = ${data.headerMenu},
      "FooterMenu"   = ${data.footerMenu},
      "SideMenu"     = ${data.sideMenu},
      "DropdownMenu" = ${data.dropdownMenu},
      "IsActive"     = ${data.isActive},
      "ParentCatID"  = ${data.parentCatId}
    WHERE "CatID" = ${id}
  `;
}

export async function softDeleteCategory(id: number): Promise<void> {
  await sql`UPDATE "Categories" SET "IsDeleted" = TRUE, "IsActive" = FALSE WHERE "CatID" = ${id}`;
}
