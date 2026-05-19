import "server-only";
import { sql } from "@/lib/db";
import type { CronJob } from "@/lib/types";
import type { IngestCategory, RoutableCategory } from "@/lib/ingest/types";
import { fetchRelatedTrends, type TrendsWindow } from "./providers/trends/serpapi";

const ALLOWED_WINDOWS: ReadonlySet<TrendsWindow> = new Set([
  "now 1-H",
  "now 4-H",
  "now 1-d",
  "now 7-d",
  "today 1-m",
  "today 3-m",
  "today 12-m",
  "today 5-y",
]);

function pickWindow(raw: unknown): TrendsWindow {
  if (typeof raw === "string" && ALLOWED_WINDOWS.has(raw as TrendsWindow)) {
    return raw as TrendsWindow;
  }
  return "now 7-d";
}
import { getActiveTextAI } from "./providers/text";
import { getPromptTemplate } from "@/lib/queries/prompts";
import { listActiveRoutableCategories } from "./db";
import { currentDateContext } from "./prompt-context";
import { getSettings } from "@/lib/queries/settings";
import {
  serpapiGeo,
  newsLanguage,
  languageEnglishName,
  locationEnglishName,
} from "@/lib/site-language";
import {
  saveDraftBatch,
  recentTitlesForCategory,
  recentTitlesForCategoryMap,
  type ArticleIdea,
} from "./article-drafts";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

export type IdeationResult = {
  trendCount: number;
  saved: number;
  duplicates: number;
};

/** Entry point — dispatches to router or single-category mode based on
 *  job.Config.routerMode. Router mode seeds SerpAPI with each active
 *  category's keywords and lets the meta-AI route ideas back into the
 *  appropriate category. Single-category mode is the legacy seed-driven
 *  flow that fills one fixed category. */
export async function ideateForJob(args: {
  job: CronJob;
  log: string[];
}): Promise<IdeationResult> {
  const { job, log } = args;
  const cfg = job.Config ?? {};
  if (cfg.routerMode) return ideateRouterMode({ job, log });
  return ideateSingleCategory({ job, log });
}

// ---------------------------------------------------------------------------
// Router mode — many categories, AI decides which one each idea belongs to.
// ---------------------------------------------------------------------------

async function ideateRouterMode(args: {
  job: CronJob;
  log: string[];
}): Promise<IdeationResult> {
  const { job, log } = args;
  const cfg = job.Config ?? {};
  const batch = clamp(Number(cfg.ideationBatchCount ?? 20), 5, 50);
  const maxCats = clamp(Number(cfg.maxCategoriesPerTick ?? 8), 1, 30);
  const perCatTrends = clamp(Number(cfg.perCategoryTrendLimit ?? 8), 3, 25);
  const guidance =
    typeof cfg.guidance === "string" ? cfg.guidance.trim() : "";
  const settings = await getSettings();
  const location = serpapiGeo(settings.SiteLocation);
  const language = newsLanguage(settings.SiteLanguage);
  const languageName = languageEnglishName(settings.SiteLanguage);
  const countryName = locationEnglishName(settings.SiteLocation);
  const window = pickWindow(cfg.trendsWindow);

  const allCats = await listActiveRoutableCategories(maxCats);
  if (allCats.length === 0) {
    log.push(`[ideation] router: no active categories. Skipping.`);
    return { trendCount: 0, saved: 0, duplicates: 0 };
  }
  log.push(
    `[ideation] router cats=${allCats.length} batch=${batch} ` +
      `perCat=${perCatTrends} loc=${location} lang=${language} window=${window}`,
  );

  // 1) Trends, dedupe-titles, AI provider, and prompt template are all
  // independent — fan them out in parallel. Per-category SerpAPI failures
  // are tolerated; the prompt template falls back to the embedded default.
  const catIds = allCats.map((c) => c.CatID);
  const [fetches, existingByCat, metaAI, promptOverride] = await Promise.all([
    Promise.allSettled(
      allCats.map(async (cat) => {
        const seed = seedFromCategory(cat);
        if (!seed) return { cat, trends: [] as { query: string }[] };
        const trends = await fetchRelatedTrends({
          seed,
          location,
          language,
          limit: perCatTrends,
          window,
        });
        return { cat, trends };
      }),
    ),
    recentTitlesForCategoryMap(catIds, 30),
    getActiveTextAI("meta"),
    getPromptTemplate("article_ideation"),
  ]);

  const taggedTrends: { catId: number; query: string }[] = [];
  for (const r of fetches) {
    if (r.status === "fulfilled") {
      const { cat, trends } = r.value;
      log.push(`[ideation] router cat=${cat.CatSeo} trends=${trends.length}`);
      for (const t of trends) {
        taggedTrends.push({ catId: cat.CatID, query: t.query });
      }
    } else {
      log.push(
        `[ideation] router serpapi fail: ${
          r.reason instanceof Error ? r.reason.message : String(r.reason)
        }`,
      );
    }
  }
  if (taggedTrends.length === 0) {
    return { trendCount: 0, saved: 0, duplicates: 0 };
  }

  log.push(`[ideation] router meta provider=${metaAI.name}`);
  const systemPrompt = (promptOverride || DEFAULT_IDEATION_SYSTEM)
    .replace(/\{language\}/g, languageName)
    .replace(/\{country\}/g, countryName);
  const userPrompt = buildRouterUserPrompt({
    cats: allCats,
    trends: taggedTrends,
    existingByCat,
    batch,
    guidance,
    languageName,
    countryName,
  });

  type IdeasResp = { ideas?: unknown };
  const resp = await metaAI.generateJSON<IdeasResp>({
    system: systemPrompt,
    user: userPrompt,
  });

  const allowedCatIds = new Set(allCats.map((c) => c.CatID));
  const fallbackByQuery = new Map<string, number>();
  for (const t of taggedTrends) {
    const k = t.query.toLowerCase();
    if (!fallbackByQuery.has(k)) fallbackByQuery.set(k, t.catId);
  }
  const ideas = parseIdeas(resp, {
    allowedCatIds,
    fallbackByQuery,
    requireCatId: true,
  });
  log.push(`[ideation] router meta returned ${ideas.length} ideas`);

  // 4) Save (each idea carries its own catId).
  const result = await saveDraftBatch({
    cronId: job.CronID,
    defaultCatId: null,
    creatorId: null,
    ideas,
  });
  log.push(
    `[ideation] router saved ${result.inserted} drafts, ${result.duplicates} dup`,
  );
  return {
    trendCount: taggedTrends.length,
    saved: result.inserted,
    duplicates: result.duplicates,
  };
}

// ---------------------------------------------------------------------------
// Single-category mode — legacy seed-driven flow.
// ---------------------------------------------------------------------------

async function ideateSingleCategory(args: {
  job: CronJob;
  log: string[];
}): Promise<IdeationResult> {
  const { job, log } = args;
  const cfg = job.Config ?? {};
  const seed = (cfg.seedQuery ?? "").toString().trim();
  const targetCatId =
    typeof cfg.targetCatId === "number" ? cfg.targetCatId : null;
  const batch = clamp(Number(cfg.ideationBatchCount ?? 20), 5, 50);
  const guidance =
    typeof cfg.guidance === "string" ? cfg.guidance.trim() : "";

  if (!seed) throw new Error("Article job missing seedQuery in Config.");
  if (!targetCatId) {
    throw new Error("Article job missing targetCatId in Config.");
  }

  const cat = await loadCategoryWithKeywords(targetCatId);
  if (!cat) throw new Error(`Target category #${targetCatId} not active`);

  const settings = await getSettings();
  const location = serpapiGeo(settings.SiteLocation);
  const language = newsLanguage(settings.SiteLanguage);
  const languageName = languageEnglishName(settings.SiteLanguage);
  const countryName = locationEnglishName(settings.SiteLocation);
  const window = pickWindow(cfg.trendsWindow);
  log.push(
    `[ideation] seed="${seed}" cat=${cat.CatSeo} batch=${batch} loc=${location} lang=${language} window=${window}`,
  );

  // Trends, recent titles, AI provider, and prompt are independent — fan out.
  const [trends, existingTitles, metaAI, promptOverride] = await Promise.all([
    fetchRelatedTrends({
      seed,
      location,
      language,
      limit: batch * 2,
      window,
    }),
    recentTitlesForCategory(cat.CatID, 200),
    getActiveTextAI("meta"),
    getPromptTemplate("article_ideation"),
  ]);
  log.push(`[ideation] serpapi returned ${trends.length} trends`);
  if (trends.length === 0) {
    return { trendCount: 0, saved: 0, duplicates: 0 };
  }

  log.push(`[ideation] meta provider=${metaAI.name}`);
  const systemPrompt = (promptOverride || DEFAULT_IDEATION_SYSTEM)
    .replace(/\{language\}/g, languageName)
    .replace(/\{country\}/g, countryName);

  const userPrompt = buildSingleUserPrompt({
    cat,
    seed,
    batch,
    guidance,
    trends: trends.map((t) => t.query),
    existingTitles,
    languageName,
    countryName,
  });

  type IdeasResp = { ideas?: unknown };
  const resp = await metaAI.generateJSON<IdeasResp>({
    system: systemPrompt,
    user: userPrompt,
  });

  const ideas = parseIdeas(resp, { requireCatId: false });
  log.push(`[ideation] meta returned ${ideas.length} ideas`);

  const result = await saveDraftBatch({
    cronId: job.CronID,
    defaultCatId: cat.CatID,
    creatorId: null,
    ideas,
  });
  log.push(
    `[ideation] saved ${result.inserted} drafts, ${result.duplicates} duplicates`,
  );
  return {
    trendCount: trends.length,
    saved: result.inserted,
    duplicates: result.duplicates,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

/** Pick the best seed for SerpAPI. Prefer keywords (richer signal), fall back
 *  to the category name. Keywords are comma-separated; we pass the first 3
 *  joined by space to keep the query focused. */
function seedFromCategory(cat: RoutableCategory): string {
  const kw = (cat.CatKeywords ?? "").trim();
  if (kw) {
    const top = kw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" ");
    if (top) return top;
  }
  return cat.CatName.trim();
}

async function loadCategoryWithKeywords(
  catId: number,
): Promise<RoutableCategory | null> {
  const rows = await sql<RoutableCategory[]>`
    SELECT "CatID","CatName","CatSeo","CatKeywords","CatDesc"
    FROM "Categories"
    WHERE "CatID" = ${catId} AND "IsActive" = TRUE AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function parseIdeas(
  resp: { ideas?: unknown },
  opts: {
    allowedCatIds?: Set<number>;
    fallbackByQuery?: Map<string, number>;
    requireCatId: boolean;
  },
): ArticleIdea[] {
  const arr = Array.isArray(resp?.ideas) ? resp.ideas : [];
  const out: ArticleIdea[] = [];
  const seenTitles = new Set<string>();
  for (const r of arr) {
    if (!isObject(r)) continue;
    const title =
      typeof r.title === "string" && r.title.trim() ? r.title.trim() : null;
    if (!title) continue;
    const key = title.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    const trendQuery =
      typeof r.trendQuery === "string" && r.trendQuery.trim()
        ? r.trendQuery.trim()
        : null;

    let catId: number | null = null;
    if (opts.requireCatId) {
      const raw = (r as { categoryId?: unknown }).categoryId;
      const candidate =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number.parseInt(raw, 10)
            : NaN;
      if (Number.isFinite(candidate) && opts.allowedCatIds?.has(candidate)) {
        catId = candidate;
      } else if (trendQuery && opts.fallbackByQuery) {
        catId = opts.fallbackByQuery.get(trendQuery.toLowerCase()) ?? null;
      }
      if (!catId) continue; // can't route → drop
    }

    const slug =
      typeof r.slug === "string" && r.slug.trim()
        ? slugify(r.slug)
        : slugify(title);
    out.push({
      title,
      summary:
        typeof r.summary === "string" ? r.summary.trim().slice(0, 500) : null,
      keywords:
        typeof r.keywords === "string"
          ? r.keywords.trim().slice(0, 300)
          : null,
      imagePrompt:
        typeof r.imagePrompt === "string"
          ? r.imagePrompt.trim().slice(0, 500)
          : null,
      slug,
      trendQuery,
      catId,
    });
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function buildSingleUserPrompt(args: {
  cat: RoutableCategory;
  seed: string;
  batch: number;
  guidance: string;
  trends: string[];
  existingTitles: string[];
  languageName: string;
  countryName: string;
}): string {
  const trendList = args.trends.map((q, i) => `${i + 1}. ${q}`).join("\n");
  const existingList = args.existingTitles
    .slice(0, 60)
    .map((t) => `- ${t}`)
    .join("\n");
  return [
    currentDateContext(),
    "",
    `Output language: ${args.languageName}. Every text field (title, summary, keywords, imagePrompt, slug) must be written in ${args.languageName}. Slug stays in lower-case latin letters where possible (transliterate if the language uses another script).`,
    `Target audience: readers in ${args.countryName}. Frame trends, references, and tone for that audience.`,
    "",
    `Site category: ${args.cat.CatName} (slug: ${args.cat.CatSeo})`,
    args.cat.CatDesc ? `Category description: ${args.cat.CatDesc}` : "",
    args.cat.CatKeywords ? `Category keywords: ${args.cat.CatKeywords}` : "",
    `Seed topic: ${args.seed}`,
    args.guidance ? `Tone / angle guidance:\n${args.guidance}` : "",
    "",
    `Trending queries (raw signals; often fragmentary or brand-only). Use them as inspiration only. Rewrite each into a clean editorial headline; never copy a query verbatim into the title.`,
    trendList,
    "",
    existingList
      ? `Avoid duplicating titles we already have:\n${existingList}`
      : "",
    "",
    `Generate up to ${args.batch} unique article ideas as JSON: {"ideas":[{title, summary, keywords, imagePrompt, slug, trendQuery}, ...]}. Drop any trend that has no real angle rather than padding the batch.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRouterUserPrompt(args: {
  cats: RoutableCategory[];
  trends: { catId: number; query: string }[];
  existingByCat: Map<number, string[]>;
  batch: number;
  guidance: string;
  languageName: string;
  countryName: string;
}): string {
  const catList = args.cats
    .map(
      (c) =>
        `- categoryId=${c.CatID} | name="${c.CatName}" | slug=${c.CatSeo}` +
        (c.CatDesc ? ` | desc="${c.CatDesc}"` : "") +
        (c.CatKeywords ? ` | keywords="${c.CatKeywords}"` : ""),
    )
    .join("\n");

  const trendList = args.trends
    .map(
      (t, i) =>
        `${i + 1}. [origin categoryId=${t.catId}] ${t.query}`,
    )
    .join("\n");

  const dedupeBlocks: string[] = [];
  for (const [catId, titles] of args.existingByCat.entries()) {
    if (titles.length === 0) continue;
    dedupeBlocks.push(
      `categoryId=${catId} already has:\n` +
        titles.slice(0, 30).map((t) => `  - ${t}`).join("\n"),
    );
  }
  const existingBlock = dedupeBlocks.join("\n\n");

  return [
    currentDateContext(),
    "",
    `Output language: ${args.languageName}. Every text field (title, summary, keywords, imagePrompt, slug) must be written in ${args.languageName}. Slug stays in lower-case latin letters where possible (transliterate if the language uses another script).`,
    `Target audience: readers in ${args.countryName}. Frame trends, references, and tone for that audience.`,
    "",
    `You are routing trending queries into the correct site category and turning them into clean editorial article ideas.`,
    "",
    `Available categories (pick categoryId from THIS list only):`,
    catList,
    args.guidance ? `\nTone / angle guidance:\n${args.guidance}` : "",
    "",
    `Trending queries (raw signals, often fragmentary or brand-only). The "origin categoryId" tag is a hint, not a binding. Feel free to reroute an idea to a different category if it fits better.`,
    trendList,
    "",
    existingBlock
      ? `Avoid duplicating any of these existing titles:\n${existingBlock}`
      : "",
    "",
    `Generate up to ${args.batch} unique article ideas. Spread them across categories. Do not cluster every idea into a single category. Drop trends that are too generic, brand-only, or off-topic for every category rather than padding the output.`,
    "",
    `Return JSON: {"ideas":[{categoryId, title, summary, keywords, imagePrompt, slug, trendQuery}, ...]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const DEFAULT_IDEATION_SYSTEM = `You are a magazine editor turning RECENT search trend signals into article ideas that real readers will click and actually read. The trend list represents what people are searching for in the past few days, so treat them as the news cycle of the moment, not as evergreen reference material.

Output language is set in the user message ("Output language: …"). Every text field you produce — title, summary, keywords, imagePrompt — must be written natively in THAT language, not translated from English. Slug stays in lower-case latin letters; transliterate non-latin scripts.

The trends you'll see are noisy. They may be fragmentary ("nvidia 50"), pure brand mentions ("samsung s26"), or weird query-speak ("python latest"). Trends are often in a different language than the output. Treat each trend as a hint, never as the headline. Rewrite into a clean, readable line you'd see on a respected news or tech site in the output language, with an angle that explains what is happening right now around that query.

Headline craft:
- Lead with a specific subject, person, place, or event when the trend gives you one. If the trend is too thin to yield a real angle, drop it instead of padding with filler.
- Vary structure across the batch. Mix declarative news leads, service pieces ("How to…"), explainers ("Why…"), profile leads, and short hard-news lines, expressed naturally in the output language. Do not repeat the same template twice in a row.
- 50 to 75 characters is a good range. Go shorter when the angle is sharp.
- Plain prose in the output language. Skip marketing verbs (the equivalents of "transforms", "revolutionizes", "game-changing"). Avoid title-case noun stacks and write the way a person would say it out loud.
- Do not pad headlines with the category name. If the piece sits in the "AI" category, you do not need every title to start with "AI ...".
- No emoji. No ALL CAPS except real acronyms (AI, NASA, GDP). No clickbait. No question titles you immediately answer.

Punctuation rules (strict, apply to every field you write):
- Never use the em dash character. If you want a pause, use a comma, a period, a colon, parentheses, or rewrite the sentence.
- Never use the en dash character. Plain hyphens inside compound words are fine.
- Do not end any field with an ellipsis.

Field rules:
- title: see headline craft above. In the output language.
- summary: one or two natural sentences in the output language, up to 220 characters. Sounds like a journalist describing the piece, not a meta description.
- keywords: 5 to 8 lowercase, comma-separated, in order of relevance, written in the output language. They should fit the body naturally; do not pick keywords just to chase ranking.
- imagePrompt: up to 200 characters describing a plausible scene a photojournalist could actually shoot. May be written in English (image models read English best). No text, logos, watermarks.
- slug: kebab-case, 4 to 10 words. Always lower-case latin; transliterate from the output language if needed.
- trendQuery: copy the exact trending query that inspired this idea.
- categoryId (when a category list is provided): pick the integer ID from that list whose readers would care most. Do not invent IDs.

Editorial safety: titles and summaries must not give medical, legal, or individualized financial advice. Do not phrase ideas as "take X to cure Y", "sue your landlord by doing Z", "buy/sell stock X now". Frame health, legal, and finance ideas as reporting on what experts, studies, rulings, or named sources say, not as direct instructions to the reader.

Skip ruthlessly. A short, sharp batch beats a padded one. If a trend yields no clean angle for any category, drop it.

Return ONLY a JSON object with a single key "ideas". No markdown, no commentary.`;
