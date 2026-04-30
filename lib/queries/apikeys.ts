import "server-only";
import { sql } from "@/lib/db";
import type { ApiKey, ApiKeyPurpose } from "@/lib/types";

// API keys are stored in plain text in ApiKeys.KeyValue (WordPress style).
// DB-level security is the baseline; no application-layer encryption.

const BASE_COLS = sql`
  "ApiKeyID", "Provider", "Purpose", "Label", "KeyValue",
  COALESCE("Config", '{}'::jsonb) AS "Config",
  COALESCE("IsActive", FALSE) AS "IsActive",
  "CreatedDate"
`;

export async function listApiKeys(): Promise<ApiKey[]> {
  return sql<ApiKey[]>`
    SELECT ${BASE_COLS} FROM "ApiKeys"
    WHERE "IsDeleted" = FALSE
    ORDER BY "Provider" ASC, "IsActive" DESC, "ApiKeyID" DESC
  `;
}

export async function getActiveApiKey(
  provider: string,
  purpose: ApiKeyPurpose,
): Promise<{ plaintext: string; config: Record<string, unknown> } | null> {
  const rows = await sql<{ KeyValue: string; Config: Record<string, unknown> }[]>`
    SELECT "KeyValue", COALESCE("Config", '{}'::jsonb) AS "Config"
    FROM "ApiKeys"
    WHERE "Provider" = ${provider}
      AND "Purpose"  = ${purpose}
      AND "IsActive" = TRUE
      AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return { plaintext: row.KeyValue, config: row.Config ?? {} };
}

/**
 * Returns the first active key for a given purpose, picking whichever
 * provider is currently active. Used by the pipeline to decide things
 * like "which text_ai should we use?"
 */
export async function getActiveKeyForPurpose(
  purpose: ApiKeyPurpose,
): Promise<{ provider: string; plaintext: string; config: Record<string, unknown> } | null> {
  const rows = await sql<{ Provider: string; KeyValue: string; Config: Record<string, unknown> }[]>`
    SELECT "Provider", "KeyValue", COALESCE("Config", '{}'::jsonb) AS "Config"
    FROM "ApiKeys"
    WHERE "Purpose"  = ${purpose}
      AND "IsActive" = TRUE
      AND "IsDeleted" = FALSE
    ORDER BY "ApiKeyID" DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    provider: row.Provider,
    plaintext: row.KeyValue,
    config: row.Config ?? {},
  };
}

export async function createApiKey(data: {
  provider: string;
  purpose: ApiKeyPurpose;
  label?: string | null;
  plaintext: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  creatorId?: number | null;
}): Promise<number> {
  if (data.isActive) {
    // Deactivate any other active key for the same (provider, purpose) pair
    await sql`
      UPDATE "ApiKeys" SET "IsActive" = FALSE
      WHERE "Provider" = ${data.provider}
        AND "Purpose"  = ${data.purpose}
        AND "IsActive" = TRUE
        AND "IsDeleted" = FALSE
    `;
  }
  const rows = await sql<{ ApiKeyID: number }[]>`
    INSERT INTO "ApiKeys" ("Provider","Purpose","Label","KeyValue","Config","IsActive","Fk_UserID")
    VALUES (
      ${data.provider},
      ${data.purpose},
      ${data.label ?? null},
      ${data.plaintext},
      ${sql.json((data.config ?? {}) as never)},
      ${data.isActive ?? false},
      ${data.creatorId ?? null}
    )
    RETURNING "ApiKeyID"
  `;
  return rows[0].ApiKeyID;
}

export async function setApiKeyActive(id: number, active: boolean): Promise<void> {
  if (active) {
    const rows = await sql<{ Provider: string; Purpose: string }[]>`
      SELECT "Provider", "Purpose" FROM "ApiKeys" WHERE "ApiKeyID" = ${id}
    `;
    const r = rows[0];
    if (r) {
      await sql`
        UPDATE "ApiKeys" SET "IsActive" = FALSE
        WHERE "Provider" = ${r.Provider} AND "Purpose" = ${r.Purpose}
          AND "IsActive" = TRUE AND "IsDeleted" = FALSE
          AND "ApiKeyID" <> ${id}
      `;
    }
  }
  await sql`UPDATE "ApiKeys" SET "IsActive" = ${active} WHERE "ApiKeyID" = ${id}`;
}

export async function softDeleteApiKey(id: number): Promise<void> {
  await sql`UPDATE "ApiKeys" SET "IsDeleted" = TRUE, "IsActive" = FALSE WHERE "ApiKeyID" = ${id}`;
}
