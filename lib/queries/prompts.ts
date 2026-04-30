import "server-only";
import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { DEFAULT_PROMPTS, type DefaultPrompt } from "@/lib/install/seeds";

export type PromptRow = {
  PromptID: number;
  PromptKey: string;
  Label: string;
  Description: string | null;
  Template: string;
  UpdatedAt: Date | null;
};

const loadAll = unstable_cache(
  async (): Promise<PromptRow[]> =>
    sql<PromptRow[]>`
      SELECT "PromptID", "PromptKey", "Label", "Description", "Template", "UpdatedAt"
      FROM "Prompts"
      WHERE "IsDeleted" = FALSE
      ORDER BY "PromptKey" ASC
    `,
  ["prompts"],
  { revalidate: 3600, tags: ["prompts"] },
);

const loadByKey = unstable_cache(
  async (key: string): Promise<PromptRow | null> => {
    const rows = await sql<PromptRow[]>`
      SELECT "PromptID", "PromptKey", "Label", "Description", "Template", "UpdatedAt"
      FROM "Prompts"
      WHERE "PromptKey" = ${key} AND "IsDeleted" = FALSE
      LIMIT 1
    `;
    return rows[0] ?? null;
  },
  ["prompts:key"],
  { revalidate: 3600, tags: ["prompts"] },
);

export const listPrompts = cache(async (): Promise<PromptRow[]> => {
  const rows = await loadAll();
  // Merge in code-defined defaults that aren't in the DB so the editor isn't empty.
  const map = new Map(rows.map((r) => [r.PromptKey, r]));
  for (const d of DEFAULT_PROMPTS) {
    if (!map.has(d.key)) {
      map.set(d.key, {
        PromptID: 0,
        PromptKey: d.key,
        Label: d.label,
        Description: d.description,
        Template: d.template,
        UpdatedAt: null,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.PromptKey.localeCompare(b.PromptKey));
});

export const getPromptTemplate = cache(async (key: string): Promise<string> => {
  try {
    const row = await loadByKey(key);
    if (row?.Template) return row.Template;
  } catch {
    /* DB yok — fallback */
  }
  const def = DEFAULT_PROMPTS.find((d) => d.key === key);
  return def?.template ?? "";
});

export function findDefault(key: string): DefaultPrompt | undefined {
  return DEFAULT_PROMPTS.find((d) => d.key === key);
}

export async function upsertPrompt(
  key: string,
  label: string,
  description: string,
  template: string,
  userId: number,
): Promise<void> {
  await sql`
    INSERT INTO "Prompts" ("PromptKey", "Label", "Description", "Template", "Fk_UserID", "UpdatedAt")
    VALUES (${key}, ${label}, ${description}, ${template}, ${userId}, NOW())
    ON CONFLICT ("PromptKey") DO UPDATE
      SET "Label" = EXCLUDED."Label",
          "Description" = EXCLUDED."Description",
          "Template" = EXCLUDED."Template",
          "Fk_UserID" = EXCLUDED."Fk_UserID",
          "UpdatedAt" = NOW(),
          "IsDeleted" = FALSE
  `;
  revalidateTag("prompts");
}

export async function resetPromptToDefault(key: string, userId: number): Promise<boolean> {
  const def = findDefault(key);
  if (!def) return false;
  await upsertPrompt(key, def.label, def.description, def.template, userId);
  return true;
}
