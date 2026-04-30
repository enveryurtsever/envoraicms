import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import type { LinkRow } from "@/lib/types";

const COLS = sql`"LinkID","LinkTitle","Link","LinkIcon","LinkSeo","LinkContent","LinkNumber","TopMenu","Footer"`;
const ORDER = sql`ORDER BY "LinkNumber" ASC NULLS LAST, "LinkID" ASC`;

function classify(rows: LinkRow[]) {
  const pages: LinkRow[] = [];
  const socials: LinkRow[] = [];
  for (const r of rows) {
    const hasUrl = !!r.Link && r.Link.trim().length > 0;
    if (r.LinkIcon && hasUrl) {
      socials.push(r);
    } else if (hasUrl || r.LinkSeo) {
      pages.push(r);
    }
  }
  return { pages, socials };
}

const loadFooter = unstable_cache(
  async () => {
    const rows = await sql<LinkRow[]>`
      SELECT ${COLS}
      FROM "Links"
      WHERE "Footer" = true AND "IsActive" = true AND "IsDeleted" = false
      ${ORDER}
    `;
    return classify(rows);
  },
  ["links:footer"],
  { revalidate: 3600, tags: ["links"] }
);

export const getFooterLinks = cache(loadFooter);

const loadTopMenu = unstable_cache(
  async () => {
    const rows = await sql<LinkRow[]>`
      SELECT ${COLS}
      FROM "Links"
      WHERE "TopMenu" = true AND "IsActive" = true AND "IsDeleted" = false
      ${ORDER}
    `;
    return rows;
  },
  ["links:top"],
  { revalidate: 3600, tags: ["links"] }
);

export const getTopMenuLinks = cache(loadTopMenu);

const loadBySlug = unstable_cache(
  async (slug: string): Promise<LinkRow | null> => {
    const rows = await sql<LinkRow[]>`
      SELECT ${COLS}
      FROM "Links"
      WHERE "LinkSeo" = ${slug}
        AND "IsActive" = true
        AND "IsDeleted" = false
      LIMIT 1
    `;
    return rows[0] ?? null;
  },
  ["link:by-slug"],
  { revalidate: 3600, tags: ["links"] }
);

export const getLinkBySlug = cache((slug: string) => loadBySlug(slug));
