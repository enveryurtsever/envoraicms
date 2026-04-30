/**
 * One-shot backfill:
 *   1. Generates a random byline + randomuser.me portrait for every category
 *      that has no author row yet.
 *   2. Assigns each Content row a category author so existing posts pick up
 *      a byline.
 *
 * Run: tsx scripts/seed-authors.ts
 *
 * Idempotent: skips categories that already have at least one author and
 * Content rows that already have FK_AuthorID.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

import postgres from "postgres";
import { requireDbConfig, buildPostgresArgs } from "../lib/db-config";
import { generateRandomAuthor } from "../lib/authors/random";
import { fetchAndStoreAuthorAvatar } from "../lib/authors/avatar";

const cfg = requireDbConfig();
const args = buildPostgresArgs(cfg, { max: 2 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = (postgres as any)(...args) as ReturnType<typeof postgres>;

type CatRow = { CatID: number; CatName: string; CatSeo: string };

async function getSiteName(): Promise<string> {
  const rows = await sql<{ SiteName: string | null }[]>`
    SELECT "SiteName" FROM "Settings" WHERE "IsDeleted" = FALSE
    ORDER BY "SettingsID" ASC LIMIT 1
  `;
  return rows[0]?.SiteName ?? "ENVORAICMS";
}

async function categoriesMissingAuthor(): Promise<CatRow[]> {
  return sql<CatRow[]>`
    SELECT c."CatID", c."CatName", c."CatSeo"
    FROM "Categories" c
    LEFT JOIN "Authors" a
      ON a."FK_CatID" = c."CatID" AND a."IsDeleted" = FALSE
    WHERE c."IsDeleted" = FALSE
    GROUP BY c."CatID", c."CatName", c."CatSeo"
    HAVING COUNT(a."AuthorID") = 0
    ORDER BY c."CatID" ASC
  `;
}

async function ensureUniqueSlug(base: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const rows = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "Authors"
      WHERE "Slug" = ${candidate} AND "IsDeleted" = FALSE
    `;
    if (rows[0].c === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function createAuthorRow(args: {
  catId: number;
  catName: string;
  catSlug: string;
  siteName: string;
}): Promise<number> {
  const gen = generateRandomAuthor({
    catSlug: args.catSlug,
    catName: args.catName,
    siteName: args.siteName,
  });
  const slug = await ensureUniqueSlug(gen.slug);
  const avatar = await fetchAndStoreAuthorAvatar(slug);
  const rows = await sql<{ AuthorID: number }[]>`
    INSERT INTO "Authors"
      ("DisplayName","Slug","Bio","AvatarURL","FK_CatID","IsActive","CreatedDate")
    VALUES
      (${gen.displayName}, ${slug}, ${gen.bio}, ${avatar}, ${args.catId}, TRUE, NOW())
    RETURNING "AuthorID"
  `;
  return rows[0].AuthorID;
}

async function backfillContentAuthors(): Promise<number> {
  // For each Content row missing FK_AuthorID, pick any active author for that
  // category (random pick keeps distribution uneven but realistic).
  const result = await sql`
    UPDATE "Contents" c
    SET "FK_AuthorID" = sub."AuthorID"
    FROM (
      SELECT DISTINCT ON (a."FK_CatID")
        a."FK_CatID", a."AuthorID"
      FROM "Authors" a
      WHERE a."IsActive" = TRUE AND a."IsDeleted" = FALSE
      ORDER BY a."FK_CatID", RANDOM()
    ) sub
    WHERE c."FK_CatID" = sub."FK_CatID"
      AND c."FK_AuthorID" IS NULL
      AND c."IsDeleted" = FALSE
  `;
  return result.count;
}

async function main() {
  const siteName = await getSiteName();
  const cats = await categoriesMissingAuthor();
  console.log(`[seed-authors] ${cats.length} categories without an author`);

  for (const cat of cats) {
    try {
      const id = await createAuthorRow({
        catId: cat.CatID,
        catName: cat.CatName,
        catSlug: cat.CatSeo,
        siteName,
      });
      console.log(`[ok] author #${id} for category "${cat.CatName}" (#${cat.CatID})`);
    } catch (err) {
      console.error(
        `[fail] category "${cat.CatName}" (#${cat.CatID}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const updated = await backfillContentAuthors();
  console.log(`[seed-authors] backfilled ${updated} content rows`);
}

main()
  .catch((err) => {
    console.error("[fatal]", err);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
