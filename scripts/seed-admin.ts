/**
 * İlk admin kullanıcısını oluşturur (interaktif).
 *
 * Run: npm run seed:admin
 *
 * Ortam değişkenlerinden (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME) okur;
 * yoksa stdin'den sorar. Var olan admin için parola sıfırlar.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { requireDbConfig, buildPostgresArgs } from "../lib/db-config";

const scrypt = promisify(scryptCb) as (p: string, s: Buffer, l: number) => Promise<Buffer>;
const cfg = requireDbConfig();
const args = buildPostgresArgs(cfg, { max: 1 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = (postgres as any)(...args) as ReturnType<typeof postgres>;

async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, 64);
  return ["scrypt", 16384, 8, 1, salt.toString("base64"), derived.toString("base64")].join("$");
}

async function prompt(rl: ReturnType<typeof createInterface>, q: string, fallback?: string): Promise<string> {
  const answer = (await rl.question(q)).trim();
  return answer || fallback || "";
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const email = (process.env.ADMIN_EMAIL ?? (await prompt(rl, "Admin e-posta: "))).toLowerCase();
    if (!email) throw new Error("email required");
    const name = process.env.ADMIN_NAME ?? (await prompt(rl, `Görünen ad [${email}]: `, email));
    const password = process.env.ADMIN_PASSWORD ?? (await prompt(rl, "Şifre (>=8 char): "));
    if (password.length < 8) throw new Error("password too short (min 8)");

    const hash = await hashPassword(password);

    const existing = await sql<{ UserID: number }[]>`
      SELECT "UserID" FROM "Users" WHERE "Email" = ${email} AND "IsDeleted" = FALSE LIMIT 1
    `;
    if (existing.length > 0) {
      await sql`
        UPDATE "Users" SET
          "PasswordHash" = ${hash},
          "Role"         = 'admin',
          "DisplayName"  = ${name},
          "IsActive"     = TRUE
        WHERE "UserID" = ${existing[0].UserID}
      `;
      console.log(`[ok] mevcut admin güncellendi (UserID=${existing[0].UserID})`);
    } else {
      const rows = await sql<{ UserID: number }[]>`
        INSERT INTO "Users" ("Email","DisplayName","PasswordHash","Role","IsActive")
        VALUES (${email}, ${name}, ${hash}, 'admin', TRUE)
        RETURNING "UserID"
      `;
      console.log(`[ok] yeni admin oluşturuldu (UserID=${rows[0].UserID})`);
    }
  } finally {
    rl.close();
  }
}

main()
  .catch((err) => {
    console.error("[fatal]", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
