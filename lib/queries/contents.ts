import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import type { Content, ContentListItem } from "@/lib/types";

const LIST_COLS = sql`
  c."ContentID", c."FK_CatID", c."ContentTitle", c."ContentShort",
  c."ContentDesc", c."ContentImage", c."ContentSeo", c."PublishDate",
  COALESCE(c."ViewCount", 0)::int AS "ViewCount",
  cat."CatSeo", cat."CatName"
`;

// PublishDate <= NOW() hides scheduled-future articles from the public site.
// The activator flips IsActive=TRUE the moment a scheduled PublishDate
// arrives, but until that tick the row may already be IsActive=TRUE with a
// future PublishDate (e.g. an editor scheduled it via /admin), or the
// activator may be queued behind a slow tick. Filtering here keeps the
// public site honest regardless of which path produced the row.
const LIST_JOIN = sql`
  FROM "Contents" c
  JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
  WHERE c."IsActive" = true AND c."IsDeleted" = false
    AND c."PublishDate" <= NOW()
    AND cat."IsActive" = true AND cat."IsDeleted" = false
`;

export const getHomepageFeatured = cache(
  unstable_cache(
    async (limit = 5): Promise<ContentListItem[]> =>
      sql<ContentListItem[]>`
        SELECT ${LIST_COLS}
        ${LIST_JOIN}
        ORDER BY c."PublishDate" DESC
        LIMIT ${limit}
      `,
    ["contents:home"],
    { revalidate: 30, tags: ["contents", "contents:home"] }
  )
);

export const getLatest = cache(
  unstable_cache(
    async (limit = 20, offset = 0): Promise<ContentListItem[]> =>
      sql<ContentListItem[]>`
        SELECT ${LIST_COLS}
        ${LIST_JOIN}
        ORDER BY c."PublishDate" DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ["contents:latest"],
    { revalidate: 60, tags: ["contents"] }
  )
);

export const getLatestExcluding = cache(
  async (excludeIds: number[], limit = 20): Promise<ContentListItem[]> => {
    const excl = excludeIds.length > 0 ? excludeIds : [0];
    return sql<ContentListItem[]>`
      SELECT ${LIST_COLS}
      ${LIST_JOIN}
        AND c."ContentID" <> ALL(${excl}::int[])
      ORDER BY c."PublishDate" DESC
      LIMIT ${limit}
    `;
  }
);

// One query → N per category, newest-first, skipping any ContentID already
// rendered above. LATERAL keeps it at O(categories) index lookups.
export const getPerCategoryLatest = cache(
  async (
    perCat = 3,
    excludeIds: number[] = []
  ): Promise<Array<{ CatID: number; CatName: string; CatSeo: string; items: ContentListItem[] }>> => {
    const excl = excludeIds.length > 0 ? excludeIds : [0];
    const rows = await sql<
      (ContentListItem & { _CatID: number; _CatNumber: number | null })[]
    >`
      SELECT
        c."ContentID", c."FK_CatID", c."ContentTitle", c."ContentShort",
        c."ContentDesc", c."ContentImage", c."ContentSeo", c."PublishDate",
        COALESCE(c."ViewCount", 0)::int AS "ViewCount",
        cat."CatSeo", cat."CatName",
        cat."CatID" AS "_CatID", cat."CatNumber" AS "_CatNumber"
      FROM "Categories" cat
      CROSS JOIN LATERAL (
        SELECT c.*
        FROM "Contents" c
        WHERE c."FK_CatID" = cat."CatID"
          AND c."IsActive" = true AND c."IsDeleted" = false
          AND c."PublishDate" <= NOW()
          AND c."ContentID" <> ALL(${excl}::int[])
        ORDER BY c."PublishDate" DESC
        LIMIT ${perCat}
      ) c
      WHERE cat."IsActive" = true AND cat."IsDeleted" = false
        AND cat."HeaderMenu" = true
      ORDER BY cat."CatNumber" ASC NULLS LAST, cat."CatID" ASC, c."PublishDate" DESC
    `;

    const groups = new Map<number, { CatID: number; CatName: string; CatSeo: string; items: ContentListItem[] }>();
    for (const r of rows) {
      const id = r._CatID;
      let g = groups.get(id);
      if (!g) {
        g = { CatID: id, CatName: r.CatName, CatSeo: r.CatSeo, items: [] };
        groups.set(id, g);
      }
      g.items.push({
        ContentID: r.ContentID,
        FK_CatID: r.FK_CatID,
        ContentTitle: r.ContentTitle,
        ContentShort: r.ContentShort,
        ContentDesc: r.ContentDesc,
        ContentImage: r.ContentImage,
        ContentSeo: r.ContentSeo,
        PublishDate: r.PublishDate,
        ViewCount: r.ViewCount,
        CatSeo: r.CatSeo,
        CatName: r.CatName,
      });
    }
    return [...groups.values()];
  }
);

export const listByAuthorId = cache(
  async (
    authorId: number,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}
  ): Promise<ContentListItem[]> => {
    const loader = unstable_cache(
      async () =>
        sql<ContentListItem[]>`
          SELECT ${LIST_COLS}
          ${LIST_JOIN}
            AND c."FK_AuthorID" = ${authorId}
          ORDER BY c."PublishDate" DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
      ["contents:author", String(authorId), String(limit), String(offset)],
      { revalidate: 120, tags: ["contents", `author:${authorId}`] }
    );
    return loader();
  }
);

export const countByAuthorId = cache(
  async (authorId: number): Promise<number> => {
    const loader = unstable_cache(
      async () => {
        const rows = await sql<{ count: string }[]>`
          SELECT COUNT(*)::text AS count
          FROM "Contents" c
          WHERE c."FK_AuthorID" = ${authorId}
            AND c."IsActive" = true
            AND c."IsDeleted" = false
            AND c."PublishDate" <= NOW()
        `;
        return Number(rows[0]?.count ?? 0);
      },
      ["contents:author:count", String(authorId)],
      { revalidate: 300, tags: ["contents", `author:${authorId}`] }
    );
    return loader();
  }
);

export const listByCategoryId = cache(
  async (
    catId: number,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}
  ): Promise<ContentListItem[]> => {
    const loader = unstable_cache(
      async () =>
        sql<ContentListItem[]>`
          SELECT ${LIST_COLS}
          ${LIST_JOIN}
            AND c."FK_CatID" = ${catId}
          ORDER BY c."PublishDate" DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
      ["contents:cat", String(catId), String(limit), String(offset)],
      { revalidate: 60, tags: ["contents", `category:${catId}`] }
    );
    return loader();
  }
);

export const countByCategoryId = cache(
  async (catId: number): Promise<number> => {
    const loader = unstable_cache(
      async () => {
        const rows = await sql<{ count: string }[]>`
          SELECT COUNT(*)::text AS count
          FROM "Contents" c
          WHERE c."FK_CatID" = ${catId}
            AND c."IsActive" = true
            AND c."IsDeleted" = false
            AND c."PublishDate" <= NOW()
        `;
        return Number(rows[0]?.count ?? 0);
      },
      ["contents:cat:count", String(catId)],
      { revalidate: 300, tags: ["contents", `category:${catId}`] }
    );
    return loader();
  }
);

export const getContentBySlug = cache(
  async (slug: string): Promise<Content | null> => {
    const loader = unstable_cache(
      async () => {
        const rows = await sql<Content[]>`
          SELECT c."ContentID", c."FK_CatID", c."FK_LangID",
                 c."ContentTitle", c."ContentShort", c."ContentDetail",
                 c."ContentAlternateTitle", c."ContentOriginalTitle",
                 c."ContentKeywords", c."ContentDesc", c."ContentImage",
                 c."ContentVideo", c."ContentSeo", c."ContentURL",
                 c."ContentSource", c."Homepage", c."IsActive",
                 c."PublishDate", c."ModifiedDate", c."CreatedDate",
                 c."FK_AuthorID",
                 cat."CatSeo", cat."CatName",
                 a."DisplayName" AS "AuthorName",
                 a."Slug"        AS "AuthorSlug",
                 a."Bio"         AS "AuthorBio",
                 a."AvatarURL"   AS "AuthorAvatarURL"
          FROM "Contents" c
          JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
          LEFT JOIN "Authors" a
            ON a."AuthorID" = c."FK_AuthorID" AND a."IsDeleted" = FALSE
          WHERE c."ContentSeo" = ${slug}
            AND c."IsActive" = true
            AND c."IsDeleted" = false
            AND c."PublishDate" <= NOW()
          LIMIT 1
        `;
        return rows[0] ?? null;
      },
      ["content:slug", slug],
      { revalidate: 600, tags: ["contents", "authors", `content:slug:${slug}`] }
    );
    return loader();
  }
);

export const getRelated = cache(
  async (catId: number, excludeId: number, limit = 4): Promise<ContentListItem[]> => {
    return sql<ContentListItem[]>`
      SELECT ${LIST_COLS}
      ${LIST_JOIN}
        AND c."FK_CatID" = ${catId}
        AND c."ContentID" <> ${excludeId}
      ORDER BY c."PublishDate" DESC
      LIMIT ${limit}
    `;
  }
);

export const searchContents = cache(
  async (q: string, { limit = 24, offset = 0 }: { limit?: number; offset?: number } = {}) => {
    // /search/ URLs are hyphenated slugs ("aging-research") — turn dashes into
    // spaces so the user's intent reaches websearch_to_tsquery as separate terms.
    const normalized = q.includes("-") && !q.includes(" ")
      ? q.replace(/-/g, " ")
      : q;
    // Backed by idx_contents_fts (GIN tsvector). websearch_to_tsquery accepts
    // user-style input ("foo bar", quoted phrases, OR) without throwing on
    // punctuation, unlike to_tsquery.
    return sql<ContentListItem[]>`
      SELECT ${LIST_COLS}
      ${LIST_JOIN}
        AND to_tsvector(
              'english',
              coalesce(c."ContentTitle",'') || ' ' ||
              coalesce(c."ContentDesc",'') || ' ' ||
              coalesce(c."ContentKeywords",'')
            ) @@ websearch_to_tsquery('english', ${normalized})
      ORDER BY
        ts_rank(
          to_tsvector(
            'english',
            coalesce(c."ContentTitle",'') || ' ' ||
            coalesce(c."ContentDesc",'') || ' ' ||
            coalesce(c."ContentKeywords",'')
          ),
          websearch_to_tsquery('english', ${normalized})
        ) DESC,
        c."PublishDate" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
);

export const getTopTags = cache(
  unstable_cache(
    async (limit = 14): Promise<string[]> => {
      const rows = await sql<{ ContentKeywords: string }[]>`
        SELECT "ContentKeywords"
        FROM "Contents"
        WHERE "IsActive" = true AND "IsDeleted" = false
          AND "PublishDate" <= NOW()
          AND "Homepage" = true
          AND "ContentKeywords" IS NOT NULL
        ORDER BY "PublishDate" DESC
        LIMIT 40
      `;
      const counts = new Map<string, number>();
      for (const row of rows) {
        for (const raw of row.ContentKeywords.split(",")) {
          const tag = raw.trim().toLowerCase();
          if (tag.length < 3 || tag.length > 40) continue;
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([t]) => t);
    },
    ["contents:top-tags"],
    { revalidate: 300, tags: ["contents"] }
  )
);

export type SitemapContent = {
  ContentSeo: string;
  CatSeo: string;
  PublishDate: string;
  ModifiedDate: string | null;
  ContentImage: string | null;
  ContentTitle: string;
};

export const getSitemapContents = cache(
  async ({ limit = 5000, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<SitemapContent[]> => {
    return sql<SitemapContent[]>`
      SELECT c."ContentSeo", cat."CatSeo", c."PublishDate",
             c."ModifiedDate", c."ContentImage", c."ContentTitle"
      FROM "Contents" c
      JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
      WHERE c."IsActive" = true AND c."IsDeleted" = false
        AND c."PublishDate" <= NOW()
        AND cat."IsActive" = true AND cat."IsDeleted" = false
      ORDER BY COALESCE(c."ModifiedDate", c."PublishDate") DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
);

export const countSitemapContents = cache(async (): Promise<number> => {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c
    FROM "Contents" c
    JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
    WHERE c."IsActive" = true AND c."IsDeleted" = false
      AND c."PublishDate" <= NOW()
      AND cat."IsActive" = true AND cat."IsDeleted" = false
  `;
  return rows[0]?.c ?? 0;
});


export const getTrendingContentIds = cache(
  async (): Promise<{ ContentSeo: string; CatSeo: string }[]> => {
    return sql<{ ContentSeo: string; CatSeo: string }[]>`
      SELECT c."ContentSeo", cat."CatSeo"
      FROM "Contents" c
      JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
      WHERE c."IsActive" = true AND c."IsDeleted" = false
        AND c."PublishDate" <= NOW()
        AND cat."IsActive" = true AND cat."IsDeleted" = false
      ORDER BY c."PublishDate" DESC
      LIMIT 500
    `;
  }
);

export const getPopular = cache(
  unstable_cache(
    async (limit = 10, sinceDays = 7): Promise<ContentListItem[]> =>
      sql<ContentListItem[]>`
        SELECT ${LIST_COLS}
        ${LIST_JOIN}
          AND c."PublishDate" >= NOW() - (${sinceDays}::int * INTERVAL '1 day')
        ORDER BY COALESCE(c."ViewCount", 0) DESC, c."PublishDate" DESC
        LIMIT ${limit}
      `,
    ["contents:popular"],
    { revalidate: 300, tags: ["contents", "contents:popular"] }
  )
);
