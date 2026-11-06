import "server-only";
import { requireApiKey } from "@/lib/ingest/config";
import { alreadyIngested } from "@/lib/ingest/db";
import { decodeEntities, htmlToText } from "./checks";
import type { GateSource } from "./engine";

export const MIN_SOURCE_CHARS = 400;
const MAX_SOURCE_CHARS = 12_000;
const MAX_DOWNLOAD_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 12_000;

// Source URLs come from third-party APIs; never let one reach internal hosts.
function isFetchableUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  return !(
    host === "localhost" ||
    host.endsWith(".local") ||
    host.includes(":") ||
    /^(0|10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(host)
  );
}

async function downloadHtml(url: string): Promise<string | null> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 envoraicms-ingest", Accept: "text/html" },
  });
  if (!res.ok || !res.body) return null;
  if (!(res.headers.get("content-type") ?? "").includes("html")) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < MAX_DOWNLOAD_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    html += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return html;
}

function extractArticleText(html: string): string {
  const withoutChrome = html.replace(
    /<(script|style|noscript|nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi,
    " ",
  );
  const article = withoutChrome.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? withoutChrome;
  const paragraphs = [...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => htmlToText(match[1]!))
    .filter((text) => text.length >= 40);
  return paragraphs.join("\n").slice(0, MAX_SOURCE_CHARS);
}

export async function fetchSourceText(url: string): Promise<string | null> {
  if (!isFetchableUrl(url)) return null;
  try {
    const html = await downloadHtml(url);
    if (!html) return null;
    const text = extractArticleText(html);
    return text.length >= MIN_SOURCE_CHARS ? text : null;
  } catch {
    return null;
  }
}

/** Turns text a news API supplied into a source, downloading the original page
 *  when the API only gave a snippet. Null when nothing usable exists. */
export async function resolveSource(args: {
  url: string | null | undefined;
  title: string | null | undefined;
  publisher: string | null | undefined;
  suppliedText: string | null | undefined;
}): Promise<GateSource | null> {
  const url = args.url ?? "";
  const supplied = htmlToText(args.suppliedText ?? "").slice(0, MAX_SOURCE_CHARS);
  const text =
    supplied.length >= MIN_SOURCE_CHARS ? supplied : url ? await fetchSourceText(url) : null;
  if (!text) return null;
  return { url, title: args.title ?? "", publisher: args.publisher ?? null, text };
}

type NewsResult = { title?: unknown; link?: unknown; source?: { name?: unknown } };

/** Finds real reporting on a trend, for jobs that start from a keyword. */
export async function findNewsSources(args: {
  query: string;
  location: string;
  language: string;
  limit?: number;
}): Promise<GateSource[]> {
  const key = await requireApiKey("serpapi", "trends_source");
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_news");
  url.searchParams.set("q", args.query);
  url.searchParams.set("gl", args.location.toLowerCase());
  url.searchParams.set("hl", args.language.toLowerCase());
  url.searchParams.set("api_key", key.plaintext);

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`SerpAPI news search ${res.status}`);
  const json = (await res.json().catch(() => null)) as { news_results?: NewsResult[] } | null;

  const sources: GateSource[] = [];
  for (const row of (json?.news_results ?? []).slice(0, 8)) {
    if (sources.length >= (args.limit ?? 3)) break;
    if (typeof row.link !== "string" || typeof row.title !== "string") continue;
    if (await alreadyIngested(row.link)) continue;
    const text = await fetchSourceText(row.link);
    if (!text) continue;
    sources.push({
      url: row.link,
      title: decodeEntities(row.title),
      publisher: typeof row.source?.name === "string" ? row.source.name : null,
      text,
    });
  }
  return sources;
}
