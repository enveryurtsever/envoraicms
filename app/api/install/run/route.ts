import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "@/lib/db";
import { isInstalled } from "@/lib/install/guard";
import { DEFAULT_PROMPTS } from "@/lib/install/seeds";
import { refreshSessionSecretCache } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scrypt = promisify(scryptCb) as (p: string, s: Buffer, l: number) => Promise<Buffer>;

type StepLog = { name: string; ok: boolean; message?: string };
type Body = {
  site?: { siteName?: unknown; siteUrl?: unknown; description?: unknown };
  admin?: { email?: unknown; name?: unknown; password?: unknown };
};

async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, 64);
  return ["scrypt", 16384, 8, 1, salt.toString("base64"), derived.toString("base64")].join("$");
}

function str(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

// postgres.js pool rejects explicit BEGIN/COMMIT: "Only use sql.begin,
// sql.reserved or max: 1". The SQL files are idempotent (IF NOT EXISTS),
// and the install can be retried on error, so an outer transaction is not
// needed — we just strip BEGIN/COMMIT/ROLLBACK lines.
function stripTransactionStatements(sqlText: string): string {
  return sqlText.replace(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;\s*$/gim, "");
}

export async function POST(req: NextRequest) {
  if (await isInstalled()) {
    return NextResponse.json(
      { ok: false, error: "already_installed", message: "Installation is already complete." },
      { status: 409 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const siteName = str(body.site?.siteName, 120);
  const siteUrl = str(body.site?.siteUrl, 300);
  const description = str(body.site?.description, 500);
  const adminEmail = str(body.admin?.email, 200).toLowerCase();
  const adminName = str(body.admin?.name, 120);
  const adminPassword = typeof body.admin?.password === "string" ? body.admin.password : "";

  if (siteName.length < 2) {
    return NextResponse.json(
      { ok: false, error: "invalid_site", message: "Site name is too short." },
      { status: 400 },
    );
  }
  if (!/^https?:\/\//i.test(siteUrl)) {
    return NextResponse.json(
      { ok: false, error: "invalid_url", message: "Site URL must start with http:// or https://." },
      { status: 400 },
    );
  }
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(adminEmail)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email", message: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (adminPassword.length < 8) {
    return NextResponse.json(
      { ok: false, error: "weak_password", message: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const steps: StepLog[] = [];
  const addStep = (name: string, ok: boolean, message?: string) => {
    steps.push({ name, ok, message });
  };

  try {
    // 1. Apply the single source-of-truth schema. Idempotent — tables, indexes
    //    and seed data all use IF NOT EXISTS / ON CONFLICT DO NOTHING, so the
    //    install can be retried safely on error.
    const schemaPath = join(process.cwd(), "deploy", "schema.sql");
    const schemaSql = await readFile(schemaPath, "utf8");
    await sql.unsafe(stripTransactionStatements(schemaSql));
    addStep("Database schema created", true);

    // 1b. Session secret. Var olan Settings'te varsa onu kullan (idempotent
    // install); otherwise generate one. The runtime cache is refreshed so
    // the admin user created in the same request can sign in immediately.
    const existingSecretRow = await sql<{ SessionSecret: string | null }[]>`
      SELECT "SessionSecret" FROM "Settings" WHERE "IsDeleted" = FALSE LIMIT 1
    `;
    const sessionSecret =
      existingSecretRow[0]?.SessionSecret && existingSecretRow[0].SessionSecret.length >= 16
        ? existingSecretRow[0].SessionSecret
        : randomBytes(32).toString("hex");
    refreshSessionSecretCache(sessionSecret);
    process.env.SESSION_SECRET = sessionSecret;
    addStep("Session secret ready", true);

    // 2. Settings singleton row (insert if missing, otherwise update)
    const existing = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "Settings" WHERE "IsDeleted" = FALSE
    `;
    const themeRow = await sql<{ ThemeID: number }[]>`
      SELECT "ThemeID" FROM "Themes" WHERE "ThemeSlug" = 'classic' LIMIT 1
    `;
    const defaultThemeId = themeRow[0]?.ThemeID ?? null;
    if ((existing[0]?.c ?? 0) === 0) {
      await sql`
        INSERT INTO "Settings"
          ("Title", "Description", "Keywords", "SiteName", "SiteUrl",
           "FK_LangID", "FK_ThemeID", "MetaRobots", "DefaultColorMode",
           "AllowColorToggle", "LlmsTxtEnabled", "AdsEnabled",
           "SessionSecret",
           "CreatedDate", "IsDeleted")
        VALUES
          (${siteName}, ${description || siteName}, ${siteName.toLowerCase()},
           ${siteName}, ${siteUrl},
           1, ${defaultThemeId}, 'index,follow', 'light',
           TRUE, TRUE, TRUE,
           ${sessionSecret},
           NOW(), FALSE)
      `;
      addStep("Site settings saved", true);
    } else {
      await sql`
        UPDATE "Settings"
           SET "SiteName" = ${siteName},
               "SiteUrl" = ${siteUrl},
               "Title" = ${siteName},
               "Description" = ${description || siteName},
               "FK_ThemeID" = COALESCE("FK_ThemeID", ${defaultThemeId}),
               "SessionSecret" = COALESCE("SessionSecret", ${sessionSecret})
         WHERE "IsDeleted" = FALSE
      `;
      addStep("Site settings updated", true);
    }

    // 3. Varnumberlan promptlar
    for (const p of DEFAULT_PROMPTS) {
      await sql`
        INSERT INTO "Prompts" ("PromptKey", "Label", "Description", "Template")
        VALUES (${p.key}, ${p.label}, ${p.description}, ${p.template})
        ON CONFLICT ("PromptKey") DO NOTHING
      `;
    }
    addStep(`Default AI prompts seeded (${DEFAULT_PROMPTS.length})`, true);

    // 4. Admin user
    const hash = await hashPassword(adminPassword);
    const existingAdmin = await sql<{ UserID: number }[]>`
      SELECT "UserID" FROM "Users" WHERE "Email" = ${adminEmail} LIMIT 1
    `;
    if (existingAdmin.length > 0) {
      await sql`
        UPDATE "Users"
           SET "PasswordHash" = ${hash},
               "Role" = 'admin',
               "DisplayName" = ${adminName},
               "IsActive" = TRUE,
               "IsDeleted" = FALSE
         WHERE "UserID" = ${existingAdmin[0].UserID}
      `;
    } else {
      await sql`
        INSERT INTO "Users" ("Email", "DisplayName", "PasswordHash", "Role", "IsActive")
        VALUES (${adminEmail}, ${adminName}, ${hash}, 'admin', TRUE)
      `;
    }
    addStep("Admin account created", true);

    // 5. Default category (so the homepage isn't empty)
    const catCount = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "Categories" WHERE "IsDeleted" = FALSE
    `;
    if ((catCount[0]?.c ?? 0) === 0) {
      await sql`
        INSERT INTO "Categories"
          ("FK_LangID", "CatName", "CatTitle", "CatSeo", "CatNumber",
           "HeaderMenu", "FooterMenu", "IsActive", "CreatedDate", "IsDeleted")
        VALUES
          (1, 'General', 'General', 'general', 1, TRUE, TRUE, TRUE, NOW(), FALSE)
      `;
      addStep("Default 'General' category created", true);
    }

    // Invalidate the unstable_cache layers that read the rows we just wrote
    // — without this, getSettings() keeps returning the pre-install defaults
    // for up to revalidate seconds (1h for "settings", 30s-5min for content
    // tags) and the new site name / categories don't show up on the public
    // site until that window expires.
    revalidateTag("settings");
    revalidateTag("contents");
    revalidateTag("categories");

    return NextResponse.json({ ok: true, steps });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    if (steps.length === 0 || steps[steps.length - 1].ok) {
      addStep("Installation aborted", false, message);
    }
    return NextResponse.json({ ok: false, error: "install_failed", message, steps }, { status: 500 });
  }
}
