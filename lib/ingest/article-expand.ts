import "server-only";
import { sql } from "@/lib/db";
import type { ArticleDraft } from "@/lib/types";
import type { IngestCategory } from "@/lib/ingest/types";
import { getActiveTextAI } from "./providers/text";
import { getPromptTemplate } from "@/lib/queries/prompts";
import { ensureUniqueSlug } from "./db";
import { makeFalaiProvider } from "./providers/image/falai";
import { downloadAndStoreImage } from "./download-image";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

type ExpandedArticle = {
  title: string;
  short: string;
  detail: string;
  keywords: string;
  desc: string;
  slug: string;
  imagePrompt?: string;
  importance?: number;
};

/** Expands an ArticleDraft into a full article + image, INSERTs into Contents,
 *  returns the new ContentID. Caller is responsible for marking the draft
 *  done/error. */
export async function expandArticleDraft(args: {
  draft: ArticleDraft;
  category: IngestCategory;
  imageProvider: "passthrough" | "falai";
  log: string[];
}): Promise<number> {
  const { draft, category, imageProvider, log } = args;

  // 1) Content AI fills in the full body + meta fields.
  const contentAI = await getActiveTextAI("content");
  log.push(`[draft#${draft.DraftID}] content provider=${contentAI.name}`);

  const systemPrompt =
    (await getPromptTemplate("article_expand")) || DEFAULT_EXPAND_SYSTEM;
  const userPrompt = buildExpandPrompt({ draft, category });

  const expanded = await contentAI.generateJSON<ExpandedArticle>({
    system: systemPrompt,
    user: userPrompt,
  });
  validateExpanded(expanded);

  // 2) Slug — prefer the freshly produced one, fall back to the seed slug.
  let slug = expanded.slug ? slugify(expanded.slug) : "";
  if (!slug && draft.Slug) slug = slugify(draft.Slug);
  if (!slug) slug = slugify(expanded.title);
  if (!slug) throw new Error("Could not derive a slug for the article");
  slug = await ensureUniqueSlug(slug);

  // 3) Image: optionally generate via fal.ai. Passthrough means "no image"
  //    (we don't have an upstream URL to download for evergreen articles);
  //    the public layout falls back to Settings.CoverImage.
  let imagePath = "";
  const promptForImage =
    expanded.imagePrompt?.trim() ||
    draft.ImagePrompt?.trim() ||
    `${expanded.title} — editorial photograph, no text, no logos`;

  if (imageProvider === "falai") {
    try {
      const provider = await makeFalaiProvider();
      imagePath = await provider.generate({
        prompt: promptForImage,
        slug,
        fallbackThumbnail: null,
      });
    } catch (err) {
      log.push(
        `[draft#${draft.DraftID}] fal.ai failed: ${
          err instanceof Error ? err.message : String(err)
        } — leaving image empty`,
      );
      imagePath = "";
    }
  } else if (draft.ImagePrompt && draft.ImagePrompt.startsWith("http")) {
    // Edge case: someone seeded a URL into ImagePrompt → try to download it.
    try {
      imagePath = await downloadAndStoreImage({
        url: draft.ImagePrompt,
        bucket: "content",
        slug,
      });
    } catch {
      imagePath = "";
    }
  }

  // 4) INSERT INTO Contents.
  const importance = clampInt(expanded.importance ?? 5, 1, 10);
  const homepage = importance >= 7;
  const { getRandomAuthorForCategory } = await import("@/lib/queries/authors");
  const author = await getRandomAuthorForCategory(category.CatID);
  const rows = await sql<{ ContentID: number }[]>`
    INSERT INTO "Contents" (
      "FK_CatID","FK_LangID","ContentTitle","ContentShort","ContentDetail",
      "ContentKeywords","ContentDesc","ContentImage","ContentSeo",
      "ContentURL","ContentSource","Homepage","IsActive","IsDeleted",
      "PublishDate","ModifiedDate","CreatedDate","ImagePrompt","FK_AuthorID"
    ) VALUES (
      ${category.CatID}, 1, ${expanded.title}, ${expanded.short}, ${expanded.detail},
      ${expanded.keywords}, ${expanded.desc}, ${imagePath || null}, ${slug},
      NULL, NULL, ${homepage}, TRUE, FALSE,
      NOW(), NOW(), NOW(),
      ${expanded.imagePrompt ?? draft.ImagePrompt ?? null},
      ${author?.AuthorID ?? null}
    )
    RETURNING "ContentID"
  `;
  const contentId = rows[0].ContentID;
  log.push(
    `[draft#${draft.DraftID}] inserted Content#${contentId} as ${slug}`,
  );
  return contentId;
}

function clampInt(n: number, lo: number, hi: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function validateExpanded(v: ExpandedArticle): void {
  if (!v || typeof v !== "object") throw new Error("Empty AI response");
  if (typeof v.title !== "string" || !v.title.trim()) {
    throw new Error("AI response missing title");
  }
  if (typeof v.detail !== "string" || v.detail.length < 200) {
    throw new Error("AI response detail too short or missing");
  }
  for (const key of ["short", "keywords", "desc"] as const) {
    if (typeof v[key] !== "string") {
      (v as Record<string, unknown>)[key] = "";
    }
  }
}

function buildExpandPrompt(args: {
  draft: ArticleDraft;
  category: IngestCategory;
}): string {
  const d = args.draft;
  return [
    `Site category: ${args.category.CatName} (slug: ${args.category.CatSeo})`,
    `Source trend (search query that inspired this piece): ${d.TrendQuery ?? "(none)"}`,
    `Seed title: ${d.Title}`,
    d.Summary ? `Seed summary: ${d.Summary}` : "",
    d.Keywords ? `Seed keywords: ${d.Keywords}` : "",
    "",
    "Write a fresh, evergreen, US-audience English article from this brief.",
    "Return strict JSON with: title, short, detail (HTML), keywords, desc, slug, imagePrompt, importance (1-10).",
    "The detail must be 700-1000 words, photojournalistic / wire-service tone, with one <h2>, at least one direct quote with attribution, and 3-5 internal search links of the form <a href=\"/search/KEYWORD\">phrase</a>.",
    "Allowed tags: <p>, <h2>, <strong>, <em>, <ul>, <li>, <a>. No <html>, <body>, <script>, <img>, <iframe>.",
    "No clickbait. No 'in this article we will explore'. Lead with a concrete fact in the first sentence.",
  ]
    .filter(Boolean)
    .join("\n");
}

const DEFAULT_EXPAND_SYSTEM = `You expand an editorial brief into a complete, original article for a US-audience English website. The brief gives you a category, a seed title, a short summary, keywords, and the trending query that inspired it.

Return STRICT JSON with these exact keys:
- title: 50-70 characters, SEO-optimized. The primary keyword (first entry in keywords) MUST appear, preferably near the start. No clickbait. No emoji. No ALL-CAPS words except acronyms. End with a concrete noun.
- short: 1-2 sentences, <= 220 characters.
- detail: 700-1000 words of HTML. Required structure:
    1. Opening paragraph answering who/what/where/when in concrete terms.
    2. At least one direct quote with attribution (real-sounding sources only — fabricate if you must but keep it plausible: e.g. industry analysts, named experts).
    3. One <h2> subheading mid-article signaling a thematic shift.
    4. Specific numbers, dates, proper nouns. No vague "some" / "many" / "recently".
    5. Vary paragraph length.
    6. Allowed tags: <p>, <h2>, <strong>, <em>, <ul>, <li>, <a>. NO <html>, <body>, <script>, <img>, <iframe>.
- keywords: 5-8 lowercase comma-separated; the first is the primary and MUST appear in title and detail body.
- desc: meta description 150-160 chars, compelling, includes primary keyword.
- slug: kebab-case 4-10 words, descriptive.
- imagePrompt: <= 200 chars, photojournalistic, no text/logos/watermarks.
- importance: integer 1-10 — newsworthiness/SEO value (typical evergreen = 4-6).

Internal keyword linking:
- Inside the detail body, turn 3-5 of the keywords into internal search links: <a href="/search/KEYWORD">phrase</a>
- Replace spaces in KEYWORD with %20.
- Only link the FIRST occurrence of each chosen keyword.
- Never put a link inside a heading.

Tone: confident professional journalism, no AI tells ("delving", "in the realm of", "it is important to note"). Report — don't editorialize.

Output ONLY the JSON object. No markdown fences, no commentary.`;
