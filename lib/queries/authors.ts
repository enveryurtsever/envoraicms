import "server-only";
import { sql } from "@/lib/db";
import type { Author } from "@/lib/types";
import { generateRandomAuthor } from "@/lib/authors/random";
import { fetchAndStoreAuthorAvatar } from "@/lib/authors/avatar";

const BASE_COLS = sql`
  "AuthorID", "DisplayName", "Slug", "Bio", "AvatarURL", "Email",
  "FK_CatID",
  COALESCE("IsActive", TRUE) AS "IsActive",
  "CreatedDate"
`;

export async function listAuthors(): Promise<Author[]> {
  return sql<Author[]>`
    SELECT ${BASE_COLS} FROM "Authors"
    WHERE "IsDeleted" = FALSE
    ORDER BY "AuthorID" ASC
  `;
}

export async function getAuthorById(id: number): Promise<Author | null> {
  const rows = await sql<Author[]>`
    SELECT ${BASE_COLS} FROM "Authors"
    WHERE "AuthorID" = ${id} AND "IsDeleted" = FALSE LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const rows = await sql<Author[]>`
    SELECT ${BASE_COLS} FROM "Authors"
    WHERE "Slug" = ${slug} AND "IsDeleted" = FALSE LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createAuthor(data: {
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  email: string | null;
  catId: number | null;
  isActive?: boolean;
}): Promise<number> {
  const rows = await sql<{ AuthorID: number }[]>`
    INSERT INTO "Authors" (
      "DisplayName","Slug","Bio","AvatarURL","Email","FK_CatID","IsActive","CreatedDate"
    ) VALUES (
      ${data.displayName}, ${data.slug}, ${data.bio}, ${data.avatarUrl},
      ${data.email}, ${data.catId}, ${data.isActive ?? true}, NOW()
    )
    RETURNING "AuthorID"
  `;
  return rows[0].AuthorID;
}

export async function updateAuthor(id: number, data: {
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  email: string | null;
  catId: number | null;
  isActive: boolean;
}): Promise<void> {
  await sql`
    UPDATE "Authors" SET
      "DisplayName" = ${data.displayName},
      "Slug"        = ${data.slug},
      "Bio"         = ${data.bio},
      "AvatarURL"   = ${data.avatarUrl},
      "Email"       = ${data.email},
      "FK_CatID"    = ${data.catId},
      "IsActive"    = ${data.isActive}
    WHERE "AuthorID" = ${id}
  `;
}

export async function softDeleteAuthor(id: number): Promise<void> {
  await sql`UPDATE "Authors" SET "IsDeleted" = TRUE, "IsActive" = FALSE WHERE "AuthorID" = ${id}`;
}

/** Returns one active author for a category, falling back to any active author.
 *  Used by Content insert paths that need a default byline. */
export async function getRandomAuthorForCategory(catId: number): Promise<Author | null> {
  const preferred = await sql<Author[]>`
    SELECT ${BASE_COLS} FROM "Authors"
    WHERE "FK_CatID" = ${catId}
      AND "IsActive" = TRUE
      AND "IsDeleted" = FALSE
    ORDER BY RANDOM() LIMIT 1
  `;
  if (preferred[0]) return preferred[0];
  const any = await sql<Author[]>`
    SELECT ${BASE_COLS} FROM "Authors"
    WHERE "IsActive" = TRUE AND "IsDeleted" = FALSE
    ORDER BY RANDOM() LIMIT 1
  `;
  return any[0] ?? null;
}

/** Generates a fresh slug. Falls back to numeric suffix on collision. */
async function ensureUniqueSlug(base: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "Authors"
      WHERE "Slug" = ${candidate} AND "IsDeleted" = FALSE
    `;
    if (existing[0].c === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Best-effort: generate a random American byline + portrait for a category.
 *  Network/avatar failures degrade gracefully (Author still inserted, no avatar). */
export async function createRandomAuthorForCategory(args: {
  catId: number;
  catSlug?: string | null;
  catName?: string | null;
  siteName: string;
}): Promise<number> {
  const gen = generateRandomAuthor({
    catSlug: args.catSlug,
    catName: args.catName,
    siteName: args.siteName,
  });
  const slug = await ensureUniqueSlug(gen.slug);
  const avatarUrl = await fetchAndStoreAuthorAvatar(slug);
  return createAuthor({
    displayName: gen.displayName,
    slug,
    bio: gen.bio,
    avatarUrl,
    email: null,
    catId: args.catId,
    isActive: true,
  });
}
