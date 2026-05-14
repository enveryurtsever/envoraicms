import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
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

const loadAll = unstable_cache(
  async (): Promise<Author[]> =>
    sql<Author[]>`
      SELECT ${BASE_COLS} FROM "Authors"
      WHERE "IsDeleted" = FALSE
      ORDER BY "AuthorID" ASC
    `,
  ["authors:all"],
  { revalidate: 3600, tags: ["authors"] },
);

export const listAuthors = cache(loadAll);

const loadById = unstable_cache(
  async (id: number): Promise<Author | null> => {
    const rows = await sql<Author[]>`
      SELECT ${BASE_COLS} FROM "Authors"
      WHERE "AuthorID" = ${id} AND "IsDeleted" = FALSE LIMIT 1
    `;
    return rows[0] ?? null;
  },
  ["author:by-id"],
  { revalidate: 3600, tags: ["authors"] },
);

export const getAuthorById = cache((id: number) => loadById(id));

const loadBySlug = unstable_cache(
  async (slug: string): Promise<Author | null> => {
    const rows = await sql<Author[]>`
      SELECT ${BASE_COLS} FROM "Authors"
      WHERE "Slug" = ${slug} AND "IsDeleted" = FALSE LIMIT 1
    `;
    return rows[0] ?? null;
  },
  ["author:by-slug"],
  { revalidate: 3600, tags: ["authors"] },
);

export const getAuthorBySlug = cache((slug: string) => loadBySlug(slug));

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

const loadActiveAuthors = unstable_cache(
  async (): Promise<Author[]> =>
    sql<Author[]>`
      SELECT ${BASE_COLS} FROM "Authors"
      WHERE "IsActive" = TRUE AND "IsDeleted" = FALSE
    `,
  ["authors:active"],
  { revalidate: 3600, tags: ["authors"] },
);

export type AuthorPicker = (catId: number | null | undefined) => Author | null;

/** Returns a closure that picks a random active author per category, in-memory.
 *  Pipelines call this once per run instead of issuing two DB queries per
 *  Content insert (the old getRandomAuthorForCategory pattern). */
export const buildAuthorPicker = cache(async (): Promise<AuthorPicker> => {
  const all = await loadActiveAuthors();
  const byCat = new Map<number, Author[]>();
  for (const a of all) {
    if (a.FK_CatID == null) continue;
    const list = byCat.get(a.FK_CatID);
    if (list) list.push(a);
    else byCat.set(a.FK_CatID, [a]);
  }
  return (catId) => {
    if (catId != null) {
      const list = byCat.get(catId);
      if (list && list.length > 0) {
        return list[Math.floor(Math.random() * list.length)];
      }
    }
    if (all.length > 0) return all[Math.floor(Math.random() * all.length)];
    return null;
  };
});

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
