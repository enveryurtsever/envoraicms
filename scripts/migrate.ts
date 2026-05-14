/**
 * Schema bootstrapper. Applies the single source-of-truth schema file
 * (deploy/schema.sql) to the configured database.
 *
 * Idempotent: every statement uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`,
 * so re-running this against an existing database is a no-op for unchanged
 * tables and additive for any new ones.
 *
 * Run: `npm run migrate`
 *
 * The /install wizard runs the same logic automatically on first boot, so for
 * GUI installs you do not need to call this manually.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { requireDbConfig, buildPostgresArgs } from "../lib/db-config";

const cfg = requireDbConfig();
const args = buildPostgresArgs(cfg, { max: 2 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = (postgres as any)(...args) as ReturnType<typeof postgres>;

const SCHEMA_FILE = join(process.cwd(), "deploy", "schema.sql");

// postgres.js pool rejects explicit BEGIN/COMMIT; the schema file is fully
// idempotent so we can drop the outer transaction lines safely.
function stripTransactionStatements(s: string): string {
  return s.replace(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;\s*$/gim, "");
}

async function main() {
  const content = await readFile(SCHEMA_FILE, "utf8");
  console.log("[apply] deploy/schema.sql");
  await sql.unsafe(stripTransactionStatements(content));
  console.log("[done]");
}

main()
  .catch((err) => {
    console.error("[fatal]", err);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
