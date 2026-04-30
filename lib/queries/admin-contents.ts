import "server-only";
import { sql } from "@/lib/db";
import type { Content, ContentListItem } from "@/lib/types";

export type AdminContentListItem = ContentListItem & {
  IsActive: boolean;
  Homepage: boolean;
  ViewCount: number;
};

export async function listAdminContents({
  limit = 50,
  offset = 0,
  catId,
  q,
  includeInactive = true,
}: {
  limit?: number;
  offset?: number;
  catId?: number | null;
  q?: string | null;
  includeInactive?: boolean;
} = {}): Promise<AdminContentListItem[]> {
  const pattern = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  return sql<AdminContentListItem[]>`
    SELECT c."ContentID", c."FK_CatID", c."ContentTitle", c."ContentShort",
           c."ContentDesc", c."ContentImage", c."ContentSeo", c."PublishDate",
           c."IsActive", c."Homepage", COALESCE(c."ViewCount", 0)::int AS "ViewCount",
           cat."CatSeo", cat."CatName"
    FROM "Contents" c
    JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
    WHERE c."IsDeleted" = FALSE
      ${includeInactive ? sql`` : sql`AND c."IsActive" = TRUE`}
      ${catId ? sql`AND c."FK_CatID" = ${catId}` : sql``}
      ${pattern
        ? sql`AND (c."ContentTitle" ILIKE ${pattern} OR c."ContentDesc" ILIKE ${pattern} OR c."ContentSeo" ILIKE ${pattern})`
        : sql``}
    ORDER BY c."PublishDate" DESC, c."ContentID" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function countAdminContents({
  catId,
  q,
}: { catId?: number | null; q?: string | null } = {}): Promise<number> {
  const pattern = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM "Contents" c
    WHERE c."IsDeleted" = FALSE
      ${catId ? sql`AND c."FK_CatID" = ${catId}` : sql``}
      ${pattern
        ? sql`AND (c."ContentTitle" ILIKE ${pattern} OR c."ContentDesc" ILIKE ${pattern} OR c."ContentSeo" ILIKE ${pattern})`
        : sql``}
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function getAdminContentById(id: number): Promise<Content | null> {
  const rows = await sql<Content[]>`
    SELECT c."ContentID", c."FK_CatID", c."FK_LangID",
           c."ContentTitle", c."ContentShort", c."ContentDetail",
           c."ContentAlternateTitle", c."ContentOriginalTitle",
           c."ContentKeywords", c."ContentDesc", c."ContentImage",
           c."ContentVideo", c."ContentSeo", c."ContentURL",
           c."ContentSource", c."Homepage", c."IsActive",
           c."PublishDate", c."ModifiedDate", c."CreatedDate", c."ImagePrompt",
           cat."CatSeo", cat."CatName"
    FROM "Contents" c
    LEFT JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
    WHERE c."ContentID" = ${id} AND c."IsDeleted" = FALSE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export type ContentInput = {
  catId: number;
  title: string;
  shortText: string | null;
  detail: string | null;
  alternateTitle: string | null;
  originalTitle: string | null;
  keywords: string | null;
  desc: string | null;
  image: string | null;
  imagePrompt: string | null;
  video: string | null;
  seo: string;
  url: string | null;
  sourceHref: string | null;
  sourceTitle: string | null;
  homepage: boolean;
  isActive: boolean;
  publishDate: Date;
};

export async function createContent(
  data: ContentInput & { creatorId?: number | null; authorId?: number | null },
): Promise<number> {
  const source =
    data.sourceHref || data.sourceTitle
      ? { href: data.sourceHref, title: data.sourceTitle }
      : null;
  // If no explicit author was passed, pull a random one for this category so
  // every post ships with a byline (manual create included).
  let authorId = data.authorId ?? null;
  if (authorId == null) {
    const { getRandomAuthorForCategory } = await import("@/lib/queries/authors");
    const a = await getRandomAuthorForCategory(data.catId);
    authorId = a?.AuthorID ?? null;
  }
  const rows = await sql<{ ContentID: number }[]>`
    INSERT INTO "Contents" (
      "FK_CatID","FK_LangID","ContentTitle","ContentShort","ContentDetail",
      "ContentAlternateTitle","ContentOriginalTitle","ContentKeywords",
      "ContentDesc","ContentImage","ImagePrompt","ContentVideo","ContentSeo","ContentURL",
      "ContentSource","Homepage","IsActive","PublishDate","ModifiedDate","Fk_UserID",
      "FK_AuthorID","CreatedDate"
    ) VALUES (
      ${data.catId}, 1, ${data.title}, ${data.shortText}, ${data.detail},
      ${data.alternateTitle}, ${data.originalTitle}, ${data.keywords},
      ${data.desc}, ${data.image}, ${data.imagePrompt}, ${data.video}, ${data.seo}, ${data.url},
      ${source ? sql.json(source as never) : null},
      ${data.homepage}, ${data.isActive}, ${data.publishDate}, ${data.publishDate},
      ${data.creatorId ?? null}, ${authorId}, NOW()
    )
    RETURNING "ContentID"
  `;
  return rows[0].ContentID;
}

export async function updateContent(id: number, data: ContentInput): Promise<void> {
  const source =
    data.sourceHref || data.sourceTitle
      ? { href: data.sourceHref, title: data.sourceTitle }
      : null;
  await sql`
    UPDATE "Contents" SET
      "FK_CatID"               = ${data.catId},
      "ContentTitle"           = ${data.title},
      "ContentShort"           = ${data.shortText},
      "ContentDetail"          = ${data.detail},
      "ContentAlternateTitle"  = ${data.alternateTitle},
      "ContentOriginalTitle"   = ${data.originalTitle},
      "ContentKeywords"        = ${data.keywords},
      "ContentDesc"            = ${data.desc},
      "ContentImage"           = ${data.image},
      "ImagePrompt"            = ${data.imagePrompt},
      "ContentVideo"           = ${data.video},
      "ContentSeo"             = ${data.seo},
      "ContentURL"             = ${data.url},
      "ContentSource"          = ${source ? sql.json(source as never) : null},
      "Homepage"               = ${data.homepage},
      "IsActive"               = ${data.isActive},
      "PublishDate"            = ${data.publishDate},
      "ModifiedDate"           = NOW()
    WHERE "ContentID" = ${id}
  `;
}

export async function softDeleteContent(id: number): Promise<void> {
  await sql`UPDATE "Contents" SET "IsDeleted" = TRUE, "IsActive" = FALSE WHERE "ContentID" = ${id}`;
}

export async function toggleContentActive(id: number, active: boolean): Promise<void> {
  await sql`UPDATE "Contents" SET "IsActive" = ${active} WHERE "ContentID" = ${id}`;
}
