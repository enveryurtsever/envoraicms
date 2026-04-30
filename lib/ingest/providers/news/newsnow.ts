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

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": HOST,
        "x-rapidapi-key": key.plaintext,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NewsNow ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json().catch(() => null)) as unknown;

  // NewsNow's payload is { news: [...] } in current docs but tolerate both.
  const list = Array.isArray(json)
    ? json
    : isObject(json) && Array.isArray((json as { news?: unknown }).news)
      ? ((json as { news: unknown[] }).news)
      : isObject(json) && Array.isArray((json as { data?: unknown }).data)
        ? ((json as { data: unknown[] }).data)
        : [];

  const articles = list
    .map(toArticle)
    .filter((a): a is NewsNowArticle => a !== null);

  if (typeof params.limit === "number" && params.limit > 0) {
    return articles.slice(0, params.limit);
  }
  return articles;
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

function toArticle(raw: unknown): NewsNowArticle | null {
  if (!isObject(raw)) return null;
  const title = typeof raw.title === "string" ? raw.title : null;
  const url = typeof raw.url === "string" ? raw.url : null;
  if (!title || !url) return null;
  const article: NewsNowArticle = {
    ...raw,
    title,
    url,
    excerpt: typeof raw.excerpt === "string" ? raw.excerpt : null,
    top_image: typeof raw.top_image === "string" ? raw.top_image : null,
    date: typeof raw.date === "string" ? raw.date : null,
    authors: Array.isArray(raw.authors)
      ? raw.authors.filter((a): a is string => typeof a === "string")
      : null,
    publisher: isObject(raw.publisher)
      ? {
          name: typeof raw.publisher.name === "string" ? raw.publisher.name : null,
          url: typeof raw.publisher.url === "string" ? raw.publisher.url : null,
        }
      : null,
    text: typeof raw.text === "string" ? raw.text : null,
  };
  return article;
}
