import "server-only";
import { createSign } from "node:crypto";

// Google Indexing API (URL notifications). Signs an RS256 JWT with the
// service account JSON, fetches an OAuth access token, then calls v3/urlNotifications:publish.
//
// API: https://developers.google.com/search/apis/indexing-api/v3/using-api
// Quota: 200 URLs per day (free tier). 429 once exceeded.

const OAUTH_URL = "https://oauth2.googleapis.com/token";
const PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const SCOPE = "https://www.googleapis.com/auth/indexing";

export type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export type NotifyType = "URL_UPDATED" | "URL_DELETED";

type TokenCache = { token: string; expiresAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __googleTokenCache: Map<string, TokenCache> | undefined;
}

function getCache(): Map<string, TokenCache> {
  if (!global.__googleTokenCache) global.__googleTokenCache = new Map();
  return global.__googleTokenCache;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function parseServiceAccount(json: string): ServiceAccount {
  const obj = JSON.parse(json) as Partial<ServiceAccount>;
  if (!obj.client_email || !obj.private_key) {
    throw new Error("service account JSON'da client_email veya private_key eksik");
  }
  return {
    client_email: obj.client_email,
    private_key: obj.private_key.replace(/\\n/g, "\n"),
    token_uri: obj.token_uri ?? OAUTH_URL,
  };
}

function signJwt(sa: ServiceAccount): string {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
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

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const cache = getCache();
  const cached = cache.get(sa.client_email);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token;
  }

  const jwt = signJwt(sa);
  const res = await fetch(sa.token_uri ?? OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("OAuth response missing access_token");
  }
  const ttl = (data.expires_in ?? 3600) * 1000;
  cache.set(sa.client_email, { token: data.access_token, expiresAt: now + ttl });
  return data.access_token;
}

export type PublishResult = {
  ok: boolean;
  httpStatus: number;
  message?: string;
};

export async function publishUrl(
  sa: ServiceAccount,
  url: string,
  type: NotifyType,
): Promise<PublishResult> {
  const token = await getAccessToken(sa);
  const res = await fetch(PUBLISH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, type }),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, message: text.slice(0, 500) };
  }
  return { ok: true, httpStatus: res.status };
}
