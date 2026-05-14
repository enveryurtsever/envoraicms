/**
 * Migration runner. deploy/migrations/*.sql dosyalarını sırayla çalıştırır.
 * Her migration dosyası tek BEGIN/COMMIT bloğu olmalı.
 *
 * Run: npm run migrate
 *
 * Hangi migration'ın uygulandığını takip eder ("_migrations" tablosunda).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { requireDbConfig, buildPostgresArgs } from "../lib/db-config";

const cfg = requireDbConfig();
const args = buildPostgresArgs(cfg, { max: 2 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = (postgres as any)(...args) as ReturnType<typeof postgres>;

const MIGRATIONS_DIR = join(process.cwd(), "deploy", "migrations");
const SCHEMA_FILE = join(process.cwd(), "deploy", "schema.sql");
const SCHEMA_MARKER = "000_schema.sql";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "name"      TEXT PRIMARY KEY,
      "appliedAt" TIMESTAMP DEFAULT NOW()
    )
  `;
}

async function alreadyApplied(name: string): Promise<boolean> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "_migrations" WHERE "name" = ${name}
  `;
  return rows[0].c > 0;
}

// postgres.js pool rejects explicit BEGIN/COMMIT. Migration files are
// idempotent (IF NOT EXISTS) and reruns are safe, so we strip the outer
// transaction lines before executing.
function stripTransactionStatements(s: string): string {
  return s.replace(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;\s*$/gim, "");
}

async function markApplied(name: string) {
  await sql`INSERT INTO "_migrations" ("name") VALUES (${name})`;
}

async function applyBaseSchema() {
  if (await alreadyApplied(SCHEMA_MARKER)) {
    console.log(`[skip] ${SCHEMA_MARKER}`);
    return;
  }
  const content = await readFile(SCHEMA_FILE, "utf8");
  console.log(`[apply] ${SCHEMA_MARKER}`);
  await sql.unsafe(stripTransactionStatements(content));
  await markApplied(SCHEMA_MARKER);
  console.log(`[ok]    ${SCHEMA_MARKER}`);
}

async function main() {
  await ensureTable();
  await applyBaseSchema();
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migrate] no migrations found");
    return;
  }

  for (const file of files) {
    if (await alreadyApplied(file)) {
      console.log(`[skip] ${file}`);
      continue;
    }
    const content = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[apply] ${file}`);
    await sql.unsafe(stripTransactionStatements(content));
    await markApplied(file);
    console.log(`[ok]    ${file}`);
  }
  console.log("[done]");
}

main()
  .catch((err) => {
    console.error("[fatal]", err);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
