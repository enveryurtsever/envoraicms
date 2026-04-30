import "server-only";
import { sql } from "@/lib/db";
import type { LinkRow } from "@/lib/types";

const COLS = sql`"LinkID","LinkTitle","Link","LinkIcon","LinkSeo","LinkContent","LinkNumber","TopMenu","Footer"`;

export async function listAllLinks(): Promise<LinkRow[]> {
  return sql<LinkRow[]>`
    SELECT ${COLS}, COALESCE("IsActive", TRUE) AS "IsActive"
    FROM "Links"
    WHERE "IsDeleted" = FALSE
    ORDER BY "LinkNumber" ASC NULLS LAST, "LinkID" ASC
  `;
}

export async function getLinkById(id: number): Promise<LinkRow | null> {
  const rows = await sql<LinkRow[]>`
    SELECT ${COLS}
    FROM "Links"
    WHERE "LinkID" = ${id} AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export type LinkInput = {
  title: string;
  url: string | null;
  icon: string | null;
  slug: string | null;
  content: string | null;
  order: number;
  topMenu: boolean;
  footer: boolean;
  isActive: boolean;
};

export async function createLink(
  data: LinkInput & { creatorId?: number | null },
): Promise<number> {
  const rows = await sql<{ LinkID: number }[]>`
    INSERT INTO "Links" (
      "LinkTitle","Link","LinkIcon","LinkSeo","LinkContent","LinkNumber",
      "TopMenu","Footer","IsActive","Fk_LangID","Fk_UserID","CreatedDate"
    ) VALUES (
      ${data.title}, ${data.url}, ${data.icon}, ${data.slug}, ${data.content},
      ${data.order}, ${data.topMenu}, ${data.footer}, ${data.isActive},
      1, ${data.creatorId ?? null}, NOW()
    )
    RETURNING "LinkID"
  `;
  return rows[0].LinkID;
}

export async function updateLink(id: number, data: LinkInput): Promise<void> {
  await sql`
    UPDATE "Links" SET
      "LinkTitle"   = ${data.title},
      "Link"        = ${data.url},
      "LinkIcon"    = ${data.icon},
      "LinkSeo"     = ${data.slug},
      "LinkContent" = ${data.content},
      "LinkNumber"  = ${data.order},
      "TopMenu"     = ${data.topMenu},
      "Footer"      = ${data.footer},
      "IsActive"    = ${data.isActive}
    WHERE "LinkID" = ${id}
  `;
}

export async function softDeleteLink(id: number): Promise<void> {
  await sql`UPDATE "Links" SET "IsDeleted" = TRUE, "IsActive" = FALSE WHERE "LinkID" = ${id}`;
}
