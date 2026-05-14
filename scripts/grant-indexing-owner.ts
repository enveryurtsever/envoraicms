/**
 * Grants the configured Indexing API service account Owner permission on the
 * Search Console property defined by Settings.SiteUrl. Workaround for the
 * "email not found" error in the new Search Console UI when adding a service
 * account as Owner.
 *
 * Flow (FILE method):
 *   1. Request a per-SA verification token from the Site Verification API.
 *   2. Write google<token>.html into public/ so it's served at the site root.
 *   3. Self-check the URL is publicly reachable with the right body.
 *   4. Ask Google to verify → SA becomes a verified owner.
 *
 * Self-contained: does not import from lib/indexing/* (those modules pull in
 * `server-only` which throws in plain Node). All JWT/OAuth logic is inline.
 *
 * Run on the server after `npm ci && npm run build && pm2 restart envoraicms`:
 *   npm run grant-indexing-owner
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createSign } from "node:crypto";
import postgres from "postgres";
import { requireDbConfig, buildPostgresArgs } from "../lib/db-config";

const OAUTH_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/siteverification";
const API_BASE = "https://www.googleapis.com/siteVerification/v1";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type SettingsRow = {
  SiteUrl: string | null;
  IndexingServiceAccountJSON: string | null;
};

async function main(): Promise<void> {
  const cfg = requireDbConfig();
  const args = buildPostgresArgs(cfg, { max: 2 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sql = (postgres as any)(...args) as ReturnType<typeof postgres>;

  try {
    const rows = await sql<SettingsRow[]>`
      SELECT "SiteUrl", "IndexingServiceAccountJSON"
      FROM "Settings"
      WHERE "IsDeleted" = FALSE
      ORDER BY "SettingsID" ASC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row?.IndexingServiceAccountJSON) {
      die("Settings.IndexingServiceAccountJSON yok. /admin/indexing → Configuration sekmesinden SA JSON kaydet.");
    }
    if (!row.SiteUrl) {
      die("Settings.SiteUrl yok. /admin/settings ekranından doldur.");
    }

    const siteUrl = row.SiteUrl.replace(/\/+$/, "") + "/";
    const sa = parseServiceAccount(row.IndexingServiceAccountJSON);

    console.log(`Service account : ${sa.client_email}`);
    console.log(`Property        : ${siteUrl}`);
    console.log("");

    const accessToken = await getAccessToken(sa, SCOPE);

    console.log("[1/4] Verification token isteniyor…");
    const verToken = await requestToken(accessToken, siteUrl);
    console.log(`      → ${verToken}`);

    console.log("[2/4] Doğrulama dosyası public/ içine yazılıyor…");
    const filePath = join(process.cwd(), "public", verToken);
    const fileBody = `google-site-verification: ${verToken}`;
    await writeFile(filePath, fileBody, "utf8");
    console.log(`      → ${filePath}`);

    console.log("[3/4] Dosyanın internetten erişilebilirliği kontrol ediliyor…");
    const probeUrl = `${siteUrl}${verToken}`;
    await selfCheck(probeUrl, fileBody);
    console.log(`      → OK (${probeUrl})`);

    console.log("[4/4] Google'dan sahiplik doğrulaması isteniyor…");
    const result = await verifyOwnership(accessToken, siteUrl);
    const owners = (result.owners as string[] | undefined) ?? [];
    console.log(`      → OK. owners: ${owners.join(", ") || "(boş döndü ama 200)"}`);

    console.log("");
    console.log("Tamam — service account artık verified owner.");
    console.log(`Doğrulama dosyası (${filePath}) yerinde kalsın; Google periyodik olarak yeniden kontrol ediyor.`);
    console.log("");
    console.log("Test: /admin/indexing → Manual submit → HTTP 200 beklenir.");
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

function parseServiceAccount(json: string): ServiceAccount {
  const obj = JSON.parse(json) as Partial<ServiceAccount>;
  if (!obj.client_email || !obj.private_key) {
    die("Service account JSON'da client_email veya private_key eksik.");
  }
  return {
    client_email: obj.client_email,
    private_key: obj.private_key.replace(/\\n/g, "\n"),
    token_uri: obj.token_uri ?? OAUTH_URL,
  };
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(sa: ServiceAccount, scope: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri ?? OAUTH_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const sig = signer.sign(sa.private_key);
  return `${unsigned}.${b64url(sig)}`;
}

async function getAccessToken(sa: ServiceAccount, scope: string): Promise<string> {
  const jwt = signJwt(sa, scope);
  const res = await fetch(sa.token_uri ?? OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  const text = await res.text();
  if (!res.ok) die(`OAuth failed (${res.status}): ${text.slice(0, 400)}`);
  const data = JSON.parse(text) as { access_token?: string };
  if (!data.access_token) die("OAuth response missing access_token");
  return data.access_token;
}

async function requestToken(accessToken: string, siteUrl: string): Promise<string> {
  const res = await fetch(`${API_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      verificationMethod: "FILE",
      site: { type: "SITE", identifier: siteUrl },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    die(`token endpoint failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = JSON.parse(text) as { token?: string };
  if (!data.token) die(`token endpoint did not return a token. Body: ${text.slice(0, 500)}`);
  return data.token;
}

async function selfCheck(url: string, expectedBody: string): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const body = (await res.text()).trim();
        if (body === expectedBody.trim()) return;
        if (attempt === 5) {
          die(`URL erişilebilir ama içerik eşleşmiyor.\nbeklenen: ${expectedBody}\ngelen   : ${body.slice(0, 200)}`);
        }
      } else if (attempt === 5) {
        die(`${url} erişilemez (HTTP ${res.status}). public/ servis ediliyor mu, PM2 ayakta mı?`);
      }
    } catch (err) {
      if (attempt === 5) die(`fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function verifyOwnership(accessToken: string, siteUrl: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/webResource?verificationMethod=FILE`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site: { type: "SITE", identifier: siteUrl },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    die(`verify endpoint failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
