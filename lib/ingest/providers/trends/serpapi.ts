import "server-only";
import { requireApiKey } from "@/lib/ingest/config";

export type TrendItem = {
  query: string;
  volume?: number;
  meta?: unknown;
};

const ENDPOINT = "https://serpapi.com/search.json";

/** SerpAPI `date` enum for the google_trends engine. Without this argument the
 *  upstream defaults to "today 12-m" (past 12 months), which surfaces stale,
 *  evergreen-feeling queries instead of what readers are actually searching
 *  for right now. We default to "now 7-d" so titles ride the past week. */
export type TrendsWindow =
  | "now 1-H"
  | "now 4-H"
  | "now 1-d"
  | "now 7-d"
  | "today 1-m"
  | "today 3-m"
  | "today 12-m"
  | "today 5-y";

const DEFAULT_WINDOW: TrendsWindow = "now 7-d";

/** Fetches trending queries related to a seed via SerpAPI's google_trends
 *  engine (data_type=RELATED_QUERIES). Falls back to google_trends_trending_now
 *  if the related-queries response is empty.
 *
 *  Throws on transport / auth errors. Returns up to `limit` items. */
export async function fetchRelatedTrends(args: {
  seed: string;
  location?: string;   // ISO-2 country, default "us"
  language?: string;   // ISO-2 language, default "en"
  limit?: number;      // default 25
  window?: TrendsWindow; // SerpAPI date enum, default "now 7-d"
}): Promise<TrendItem[]> {
  const seed = args.seed.trim();
  if (!seed) return [];
  const limit = Math.max(1, Math.min(50, args.limit ?? 25));
  const country = (args.location ?? "us").toLowerCase();
  const lang = (args.language ?? "en").toLowerCase();
  const window = args.window ?? DEFAULT_WINDOW;

  const key = await requireApiKey("serpapi", "trends_source");

  // 1) RELATED_QUERIES — the rich path.
  const related = await callSerpApi(key.plaintext, {
    engine: "google_trends",
    q: seed,
    data_type: "RELATED_QUERIES",
    geo: country.toUpperCase(),
    hl: lang,
    date: window,
  });
  const fromRelated = parseRelatedQueries(related, limit);
  if (fromRelated.length > 0) return fromRelated;

  // 2) Fallback: trending now in the same geo (this engine ignores `date`).
  const trending = await callSerpApi(key.plaintext, {
    engine: "google_trends_trending_now",
    geo: country.toUpperCase(),
    hl: lang,
  });
  return parseTrendingNow(trending, limit);
}

async function callSerpApi(
  apiKey: string,
  params: Record<string, string>,
): Promise<unknown> {
  const url = new URL(ENDPOINT);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", apiKey);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SerpAPI ${res.status}: ${text.slice(0, 300)}`);
  }
  return await res.json().catch(() => null);
}

function parseRelatedQueries(json: unknown, limit: number): TrendItem[] {
  if (!isObject(json)) return [];
  const rq = (json as { related_queries?: unknown }).related_queries;
  if (!isObject(rq)) return [];
  const out: TrendItem[] = [];
  const seen = new Set<string>();
  for (const bucket of ["rising", "top"] as const) {
    const arr = (rq as Record<string, unknown>)[bucket];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      if (!isObject(row)) continue;
      const q = typeof row.query === "string" ? row.query.trim() : null;
      if (!q) continue;
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const valueRaw = (row as { value?: unknown }).value;
      const volume =
        typeof valueRaw === "number"
          ? valueRaw
          : typeof valueRaw === "string"
            ? Number.parseInt(valueRaw, 10) || undefined
            : undefined;
      out.push({ query: q, volume, meta: row });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function parseTrendingNow(json: unknown, limit: number): TrendItem[] {
  if (!isObject(json)) return [];
  const list =
    (json as { trending_searches?: unknown }).trending_searches ??
    (json as { trends?: unknown }).trends;
  if (!Array.isArray(list)) return [];
  const out: TrendItem[] = [];
  const seen = new Set<string>();
  for (const row of list) {
    if (!isObject(row)) continue;
    const q =
      (typeof row.query === "string" && row.query.trim()) ||
      (typeof (row as { title?: unknown }).title === "string" &&
        ((row as { title: string }).title).trim()) ||
      null;
    if (!q) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ query: q, meta: row });
    if (out.length >= limit) return out;
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
