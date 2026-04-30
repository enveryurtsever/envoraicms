import "server-only";
import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";

export type AdZone = {
  AdZoneID: number;
  Slot: string;
  Label: string | null;
  HtmlSnippet: string | null;
  IsActive: boolean;
  StartsAt: Date | string | null;
  EndsAt: Date | string | null;
  ImpressionNote: string | null;
  UpdatedAt: Date | string;
};

const COLS = sql`
  "AdZoneID", "Slot", "Label", "HtmlSnippet", "IsActive",
  "StartsAt", "EndsAt", "ImpressionNote", "UpdatedAt"
`;

export const getActiveAdForSlot = cache((slot: string) => {
  const loader = unstable_cache(
    async (): Promise<AdZone | null> => {
      const rows = await sql<AdZone[]>`
        SELECT ${COLS}
        FROM "AdZones"
        WHERE "Slot" = ${slot}
          AND "IsDeleted" = FALSE
          AND "IsActive" = TRUE
          AND ("StartsAt" IS NULL OR "StartsAt" <= NOW())
          AND ("EndsAt"   IS NULL OR "EndsAt"   >= NOW())
        LIMIT 1
      `;
      return rows[0] ?? null;
    },
    ["adzone:slot", slot],
    { revalidate: 300, tags: ["adzones", `adzone:${slot}`] },
  );
  return loader();
});

export async function listAdZones(): Promise<AdZone[]> {
  return sql<AdZone[]>`
    SELECT ${COLS}
    FROM "AdZones"
    WHERE "IsDeleted" = FALSE
    ORDER BY "Slot" ASC
  `;
}

export type AdZoneInput = {
  slot: string;
  label: string | null;
  htmlSnippet: string | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  note: string | null;
};

export async function upsertAdZone(data: AdZoneInput, userId: number | null): Promise<void> {
  await sql`
    INSERT INTO "AdZones" (
      "Slot","Label","HtmlSnippet","IsActive","StartsAt","EndsAt","ImpressionNote","UpdatedAt","Fk_UserID"
    ) VALUES (
      ${data.slot}, ${data.label}, ${data.htmlSnippet}, ${data.isActive},
      ${data.startsAt}, ${data.endsAt}, ${data.note}, NOW(), ${userId}
    )
    ON CONFLICT ("Slot") DO UPDATE SET
      "Label"          = EXCLUDED."Label",
      "HtmlSnippet"    = EXCLUDED."HtmlSnippet",
      "IsActive"       = EXCLUDED."IsActive",
      "StartsAt"       = EXCLUDED."StartsAt",
      "EndsAt"         = EXCLUDED."EndsAt",
      "ImpressionNote" = EXCLUDED."ImpressionNote",
      "UpdatedAt"      = NOW(),
      "Fk_UserID"      = EXCLUDED."Fk_UserID",
      "IsDeleted"      = FALSE
  `;
  revalidateTag("adzones");
  revalidateTag(`adzone:${data.slot}`);
}

export async function countActiveAdZones(): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM "AdZones"
    WHERE "IsDeleted" = FALSE AND "IsActive" = TRUE
  `;
  return Number(rows[0]?.count ?? 0);
}
