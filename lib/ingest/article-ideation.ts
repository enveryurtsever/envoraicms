import "server-only";
import { sql } from "@/lib/db";
import type { CronJob } from "@/lib/types";
import type { IngestCategory } from "@/lib/ingest/types";
import { fetchRelatedTrends } from "./providers/trends/serpapi";
import { getActiveTextAI } from "./providers/text";
import { getPromptTemplate } from "@/lib/queries/prompts";
import {
  saveDraftBatch,
  recentTitlesForCategory,
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

/** Fetches related trends for the job's seed query, then asks the active
 *  meta-AI to turn them into N evergreen article ideas. Saves results as
 *  pending ArticleDrafts. */
export async function ideateForJob(args: {
  job: CronJob;
  log: string[];
}): Promise<{ trendCount: number; saved: number; duplicates: number }> {
  const { job, log } = args;
  const cfg = job.Config ?? {};
  const seed = (cfg.seedQuery ?? "").toString().trim();
  const targetCatId =
    typeof cfg.targetCatId === "number" ? cfg.targetCatId : null;
  const batch =
    Math.max(5, Math.min(50, Number(cfg.ideationBatchCount ?? 20)));
  const guidance =
    typeof cfg.guidance === "string" ? cfg.guidance.trim() : "";

  if (!seed) throw new Error("Article job missing seedQuery in Config.");
  if (!targetCatId) {
    throw new Error("Article job missing targetCatId in Config.");
  }

  const cat = await loadCategory(targetCatId);
  if (!cat) throw new Error(`Target category #${targetCatId} not active`);

  log.push(
    `[ideation] seed="${seed}" cat=${cat.CatSeo} batch=${batch} loc=${
      cfg.trendsLocation ?? "us"
    } lang=${cfg.trendsLanguage ?? "en"}`,
  );

  // 1) SerpAPI trends (request ~2x batch so we have margin to dedupe).
  const trends = await fetchRelatedTrends({
    seed,
    location: cfg.trendsLocation as string | undefined,
    language: cfg.trendsLanguage as string | undefined,
    limit: batch * 2,
  });
  log.push(`[ideation] serpapi returned ${trends.length} trends`);
  if (trends.length === 0) {
    return { trendCount: 0, saved: 0, duplicates: 0 };
  }

  // 2) existing titles for category-level dedupe hint.
  const existingTitles = await recentTitlesForCategory(cat.CatID, 200);

  // 3) Meta AI generates {title, summary, keywords, imagePrompt, slug} per trend.
  const metaAI = await getActiveTextAI("meta");
  log.push(`[ideation] meta provider=${metaAI.name}`);

  const systemPrompt =
    (await getPromptTemplate("article_ideation")) || DEFAULT_IDEATION_SYSTEM;

  const userPrompt = buildUserPrompt({
    cat,
    seed,
    batch,
    guidance,
    trends: trends.map((t) => t.query),
    existingTitles,
  });

  type IdeasResp = { ideas?: unknown };
  const resp = await metaAI.generateJSON<IdeasResp>({
    system: systemPrompt,
    user: userPrompt,
  });

  const ideas = parseIdeas(resp, trends.map((t) => t.query));
  log.push(`[ideation] meta returned ${ideas.length} ideas`);

  // 4) Save batch (unique partial index dedupes by (cat, lower(title))).
  const result = await saveDraftBatch({
    cronId: job.CronID,
    catId: cat.CatID,
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

async function loadCategory(catId: number): Promise<IngestCategory | null> {
  const rows = await sql<IngestCategory[]>`
    SELECT "CatID","CatName","CatSeo" FROM "Categories"
    WHERE "CatID" = ${catId} AND "IsActive" = TRUE AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function parseIdeas(resp: { ideas?: unknown }, fallbackTrends: string[]): ArticleIdea[] {
  const arr = Array.isArray(resp?.ideas) ? resp.ideas : [];
  const out: ArticleIdea[] = [];
  const seenTitles = new Set<string>();
  for (let i = 0; i < arr.length; i++) {
    const r = arr[i];
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
        : fallbackTrends[i] ?? null;
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
    });
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function buildUserPrompt(args: {
  cat: IngestCategory;
  seed: string;
  batch: number;
  guidance: string;
  trends: string[];
  existingTitles: string[];
}): string {
  const trendList = args.trends.map((q, i) => `${i + 1}. ${q}`).join("\n");
  const existingList = args.existingTitles
    .slice(0, 60)
    .map((t) => `- ${t}`)
    .join("\n");
  return [
    `Site category: ${args.cat.CatName} (slug: ${args.cat.CatSeo})`,
    `Seed topic: ${args.seed}`,
    args.guidance ? `Tone / angle guidance:\n${args.guidance}` : "",
    "",
    `Trending queries (use these as the primary source of inspiration; pick the most evergreen / high-intent ones):`,
    trendList,
    "",
    existingList
      ? `Avoid duplicating titles we already have:\n${existingList}`
      : "",
    "",
    `Generate exactly ${args.batch} unique article ideas as JSON: {"ideas":[{title, summary, keywords, imagePrompt, slug, trendQuery}, ...]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const DEFAULT_IDEATION_SYSTEM = `You are an SEO editor for an English-language website. You take a seed topic and a list of related trending search queries, and you produce evergreen article ideas tailored to a specific site category.

Rules for every idea:
- title: 50-70 characters, SEO-optimized, no clickbait, no emoji, no ALL-CAPS words. Include the primary keyword near the start. End with a concrete noun.
- summary: 1-2 sentences, <= 220 characters. Concrete, no vague filler.
- keywords: 5-8 lowercase comma-separated keywords. The first keyword is the primary keyword and MUST appear in the title.
- imagePrompt: <=200 characters. Photojournalistic / editorial style. No text/logos/watermarks.
- slug: kebab-case, 4-10 words.
- trendQuery: copy the related trending query that inspired this idea verbatim.

Return ONLY a JSON object with a single key "ideas" — an array of the requested length. No markdown, no commentary.`;
