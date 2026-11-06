import "server-only";
import { sql } from "@/lib/db";
import {
  duplicateSlugBase,
  htmlToText,
  scoreArchiveArticle,
  type ArchiveFlag,
} from "@/lib/ingest/gate/checks";

const SCAN_LIMIT = 5000;
const RESULT_LIMIT = 200;

export type ArchiveRow = {
  id: number;
  title: string;
  path: string;
  score: number;
  flags: ArchiveFlag[];
  /** For a -2/-3 URL: the live original it should redirect to. */
  originalPath: string | null;
};

type ScanRow = {
  ContentID: number;
  ContentTitle: string;
  ContentSeo: string;
  ContentDetail: string | null;
  CatSeo: string;
};

async function loadPublished(): Promise<ScanRow[]> {
  return sql<ScanRow[]>`
    SELECT c."ContentID", c."ContentTitle", c."ContentSeo", c."ContentDetail", cat."CatSeo"
    FROM "Contents" c
    JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
    WHERE c."IsActive" = TRUE AND c."IsDeleted" = FALSE AND c."ContentSeo" IS NOT NULL
    ORDER BY c."PublishDate" DESC
    LIMIT ${SCAN_LIMIT}
  `;
}

function pathOf(row: Pick<ScanRow, "CatSeo" | "ContentSeo">): string {
  return `/${row.CatSeo}/${row.ContentSeo}`;
}

/** Published articles worth a look, riskiest first. Reads the newest articles
 *  only, so a very large archive may need several rounds of cleanup. */
export async function scanArchive(): Promise<{ scanned: number; rows: ArchiveRow[] }> {
  const published = await loadPublished();
  const bySlug = new Map(published.map((row) => [row.ContentSeo, row]));

  const rows = published
    .map((row): ArchiveRow => {
      const base = duplicateSlugBase(row.ContentSeo);
      const original = base ? bySlug.get(base) : undefined;
      const { score, flags } = scoreArchiveArticle({
        title: row.ContentTitle,
        text: htmlToText(row.ContentDetail ?? ""),
        isDuplicateUrl: Boolean(original),
      });
      return {
        id: row.ContentID,
        title: row.ContentTitle,
        path: pathOf(row),
        score,
        flags,
        originalPath: original ? pathOf(original) : null,
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_LIMIT);

  return { scanned: published.length, rows };
}

export type RetiredArticle = { id: number; title: string; path: string };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Takes an article off the site: unpublishes it, so sitemap, RSS and author
 *  pages drop it, and answers its URL with a 301 or 410 from now on. */
export async function retireArticle(
  id: number,
  rule: { status: 301; target: string } | { status: 410 },
): Promise<RetiredArticle | null> {
  const rows = await sql<ScanRow[]>`
    SELECT c."ContentID", c."ContentTitle", c."ContentSeo", c."ContentDetail", cat."CatSeo"
    FROM "Contents" c
    JOIN "Categories" cat ON cat."CatID" = c."FK_CatID"
    WHERE c."ContentID" = ${id} AND c."ContentSeo" IS NOT NULL
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  const path = pathOf(row);
  const target = rule.status === 301 ? rule.target : null;
  if (target === path) throw new Error("An article can't redirect to itself.");

  await sql`
    UPDATE "Contents"
       SET "IsDeleted" = TRUE, "IsActive" = FALSE, "AwaitingActivation" = FALSE
     WHERE "ContentID" = ${id}
  `;
  await sql`
    INSERT INTO "UrlRules" ("Path", "Status", "Target", "FK_ContentID")
    VALUES (${path}, ${rule.status}, ${target}, ${id})
    ON CONFLICT ("Path") DO UPDATE
      SET "Status" = EXCLUDED."Status", "Target" = EXCLUDED."Target", "CreatedDate" = NOW()
  `;
  // Redirects that pointed here must not chain or end on a dead page.
  if (target) {
    await sql`UPDATE "UrlRules" SET "Target" = ${target} WHERE "Target" = ${path}`;
  } else {
    await sql`UPDATE "UrlRules" SET "Status" = 410, "Target" = NULL WHERE "Target" = ${path}`;
    // Keep the anchor text, drop the link. The modified date stays untouched
    // because the article's content hasn't really changed.
    // Postgres applies one greediness to a whole regex, so `.*?` would run past
    // the closing tag; the capture group below can't cross an </a> instead.
    const pattern = `<a\\s[^>]*href=["'](?:https?://[^"'/]+)?${escapeRegex(path)}/?["'][^>]*>((?:[^<]|<(?!/a>))*)</a>`;
    await sql`
      UPDATE "Contents"
         SET "ContentDetail" = regexp_replace("ContentDetail", ${pattern}, '\\1', 'gi')
       WHERE "ContentDetail" LIKE ${`%${path}%`}
    `;
  }
  return { id, title: row.ContentTitle, path };
}

/** Sends every -2/-3 URL to its original. */
export async function retireDuplicateUrls(): Promise<RetiredArticle[]> {
  const published = await loadPublished();
  const bySlug = new Map(published.map((row) => [row.ContentSeo, row]));
  const retired: RetiredArticle[] = [];
  for (const row of published) {
    const base = duplicateSlugBase(row.ContentSeo);
    const original = base ? bySlug.get(base) : undefined;
    if (!original) continue;
    const done = await retireArticle(row.ContentID, { status: 301, target: pathOf(original) });
    if (done) retired.push(done);
  }
  return retired;
}
