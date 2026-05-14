import "server-only";
import { requireApiKey } from "@/lib/ingest/config";
import type { NewsNowArticle, NewsNowFetchParams } from "@/lib/ingest/types";

// NewsNow (RapidAPI) — POST https://newsnow.p.rapidapi.com/newsv2_top_news_cat
//   body: { category, location, language, page }
//   header: x-rapidapi-key from ApiKeys table (provider='newsnow', purpose='news_source')
// Response shape varies; we accept either { news: [...] } or a top-level array.

const ENDPOINT = "https://newsnow.p.rapidapi.com/newsv2_top_news_cat";
const HOST = "newsnow.p.rapidapi.com";

// NewsNow's category enum — useful for the admin form. Free-form is also
// accepted (the API rejects unknown ones with a 400).
export const NEWSNOW_CATEGORIES = [
  "BUSINESS",
  "ENTERTAINMENT",
  "GENERAL",
  "HEALTH",
  "NATION",
  "SCIENCE",
  "SPORTS",
  "TECHNOLOGY",
  "WORLD",
] as const;
export type NewsNowCategory = (typeof NEWSNOW_CATEGORIES)[number];

export const NEWSNOW_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "tr", "ar"] as const;
export const NEWSNOW_LOCATIONS = [
  "us", "gb", "ca", "au", "in", "de", "fr", "tr", "es", "it", "br", "mx", "jp", "kr",
] as const;

/** Fetches one page of top news for the given category.
 *  Throws on transport/HTTP errors and on missing / inactive API key.
 *  Returns the parsed article array — may be empty. */
export async function fetchNewsNow(
  params: NewsNowFetchParams,
): Promise<NewsNowArticle[]> {
  const key = await requireApiKey("newsnow", "news_source");

  const body = {
    category: params.category,
    location: params.location ?? "us",
    language: params.language ?? "en",
    page: params.page ?? 1,
  };

  const res = await fetchWithRetry(body, key.plaintext);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Include the request body so a 400 from RapidAPI is debuggable from the
    // admin trigger toast without having to dig through server logs.
    throw new Error(
      `NewsNow ${res.status} (POST ${ENDPOINT}, body=${JSON.stringify(body)}): ${text.slice(0, 300)}`,
    );
  }
  const json = (await res.json().catch(() => null)) as unknown;

  const list = extractArticleList(json);
  if (list.length === 0 && isObject(json)) {
    // Surface unexpected payload shapes — the admin can see which keys came
    // back and adjust the parser if RapidAPI's schema changes.
    const keys = Object.keys(json).slice(0, 8).join(",");
    throw new Error(
      `NewsNow returned no articles. Top-level keys: [${keys}]. Raw: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }

  const articles = list
    .map(toArticle)
    .filter((a): a is NewsNowArticle => a !== null);

  if (typeof params.limit === "number" && params.limit > 0) {
    return articles.slice(0, params.limit);
  }
  return articles;
}

/** Retries on timeout and 5xx — RapidAPI's NewsNow endpoint occasionally
 *  stalls past a minute on large categories like TECHNOLOGY. 4xx is returned
 *  as-is so the caller can surface the body in the error toast. */
async function fetchWithRetry(
  body: Record<string, unknown>,
  apiKey: string,
): Promise<Response> {
  const TIMEOUT_MS = 60_000;
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [2_000, 5_000];

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": HOST,
          "x-rapidapi-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_MS[attempt - 1]);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const timedOut = ctrl.signal.aborted;
      if (attempt >= MAX_ATTEMPTS) {
        if (timedOut) {
          throw new Error(
            `NewsNow request timed out after ${TIMEOUT_MS / 1000}s on all ${MAX_ATTEMPTS} attempts (POST ${ENDPOINT}, body=${JSON.stringify(body)}).`,
          );
        }
        throw err;
      }
      await sleep(BACKOFF_MS[attempt - 1]);
    } finally {
      clearTimeout(timer);
    }
  }
  // Unreachable — loop either returns or throws — but TS needs it.
  throw lastErr instanceof Error ? lastErr : new Error("NewsNow fetch failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** NewsNow's wrapper key has shifted historically. Accept any of the common
 *  shapes so a schema tweak on RapidAPI's side doesn't silently zero us out. */
function extractArticleList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (!isObject(json)) return [];
  for (const key of ["news", "data", "articles", "results", "items"] as const) {
    const v = (json as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v;
    if (isObject(v)) {
      for (const inner of ["news", "articles", "results", "items"] as const) {
        const iv = (v as Record<string, unknown>)[inner];
        if (Array.isArray(iv)) return iv;
      }
    }
  }
  return [];
}

/** Stable de-dup key — prefer URL since NewsNow doesn't always include an id. */
export function externalIdFor(article: NewsNowArticle): string | null {
  if (article.url && typeof article.url === "string" && article.url.length > 0) {
    return article.url;
  }
  const id = (article as { id?: unknown }).id;
  if (typeof id === "string" || typeof id === "number") return String(id);
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function toArticle(raw: unknown): NewsNowArticle | null {
  if (!isObject(raw)) return null;
  const title = pickString(raw, ["title", "headline", "name"]);
  const url = pickString(raw, ["url", "link", "href", "webUrl"]);
  if (!title || !url) return null;
  const publisher = isObject(raw.publisher)
    ? {
        name: pickString(raw.publisher, ["name", "title"]),
        url: pickString(raw.publisher, ["url", "link", "href"]),
      }
    : isObject(raw.source)
      ? {
          name: pickString(raw.source, ["name", "title"]),
          url: pickString(raw.source, ["url", "link", "href"]),
        }
      : null;
  const article: NewsNowArticle = {
    ...raw,
    title,
    url,
    excerpt: pickString(raw, ["excerpt", "description", "summary", "snippet"]),
    top_image: pickString(raw, ["top_image", "image", "urlToImage", "thumbnail"]),
    date: pickString(raw, ["date", "publishedAt", "pubDate", "published"]),
    authors: Array.isArray(raw.authors)
      ? raw.authors.filter((a): a is string => typeof a === "string")
      : null,
    publisher,
    text: pickString(raw, ["text", "content", "body", "articleBody"]),
  };
  return article;
}
