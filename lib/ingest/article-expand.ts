import "server-only";
import { sql } from "@/lib/db";
import type { ArticleDraft } from "@/lib/types";
import type { IngestCategory } from "@/lib/ingest/types";
import { getActiveTextAI } from "./providers/text";
import { getPromptTemplate } from "@/lib/queries/prompts";
import { ensureUniqueSlug } from "./db";
import { makeFalaiProvider } from "./providers/image/falai";
import { downloadAndStoreImage } from "./download-image";
import { fixSearchLinks } from "./sanitize-links";
import { currentDateContext } from "./prompt-context";
import type { AuthorPicker } from "@/lib/queries/authors";
import {
  buildContentUrl,
  submitIndexingFireAndForget,
} from "@/lib/indexing/submit";

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
  pickAuthor: AuthorPicker;
  /** Backdate PublishDate by this many minutes so a batch of inserts
   *  spreads across a believable window instead of clustering on one
   *  identical timestamp. */
  staggerMinutes?: number;
}): Promise<number> {
  const { draft, category, imageProvider, log, pickAuthor, staggerMinutes = 0 } = args;

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
  expanded.detail = fixSearchLinks(expanded.detail);

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
    `${expanded.title}. Editorial photograph, no text, no logos.`;

  if (imageProvider === "falai") {
    try {
      const provider = await makeFalaiProvider();
      imagePath = await provider.generate({
        prompt: promptForImage,
        slug,
        fallbackThumbnail: null,
      });
      log.push(`[draft#${draft.DraftID}] [falai] generated image`);
    } catch (err) {
      log.push(
        `[draft#${draft.DraftID}] fal.ai failed: ${
          err instanceof Error ? err.message : String(err)
        }. Leaving image empty.`,
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

  // 4) INSERT INTO Contents. PublishDate is shifted INTO THE FUTURE by
  //    staggerMinutes — the order in this expansion batch decides when each
  //    article goes live. IsActive is FALSE while the publish moment is in
  //    the future; the scheduler activator flips it to TRUE on time and
  //    fires the indexing call at that point.
  const importance = clampInt(expanded.importance ?? 5, 1, 10);
  const homepage = importance >= 7;
  const author = pickAuthor(category.CatID);
  const isActive = staggerMinutes <= 0;
  const rows = await sql<{ ContentID: number }[]>`
    INSERT INTO "Contents" (
      "FK_CatID","FK_LangID","ContentTitle","ContentShort","ContentDetail",
      "ContentKeywords","ContentDesc","ContentImage","ContentSeo",
      "ContentURL","ContentSource","Homepage","IsActive","IsDeleted",
      "PublishDate","ModifiedDate","CreatedDate","ImagePrompt","FK_AuthorID"
    ) VALUES (
      ${category.CatID}, 1, ${expanded.title}, ${expanded.short}, ${expanded.detail},
      ${expanded.keywords}, ${expanded.desc}, ${imagePath || null}, ${slug},
      NULL, NULL, ${homepage}, ${isActive}, FALSE,
      NOW() + (${staggerMinutes} || ' minutes')::interval,
      NOW() + (${staggerMinutes} || ' minutes')::interval,
      NOW(),
      ${expanded.imagePrompt ?? draft.ImagePrompt ?? null},
      ${author?.AuthorID ?? null}
    )
    RETURNING "ContentID"
  `;
  const contentId = rows[0].ContentID;
  log.push(
    `[draft#${draft.DraftID}] inserted Content#${contentId} as ${slug} ` +
      (isActive
        ? "(live now)"
        : `(scheduled in ${staggerMinutes} min)`),
  );

  // Only ping Google when the article is live. The activator fires its own
  // indexing call when it flips IsActive=TRUE for scheduled articles.
  if (isActive) {
    try {
      const url = await buildContentUrl(category.CatSeo, slug);
      submitIndexingFireAndForget(contentId, url, "URL_UPDATED");
    } catch (err) {
      log.push(
        `[draft#${draft.DraftID}] indexing dispatch failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

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
    currentDateContext(),
    "",
    `Site category: ${args.category.CatName} (slug: ${args.category.CatSeo})`,
    `Source trend (search query that inspired this piece): ${d.TrendQuery ?? "(none)"}`,
    `Seed title: ${d.Title}`,
    d.Summary ? `Seed summary: ${d.Summary}` : "",
    d.Keywords ? `Seed keywords: ${d.Keywords}` : "",
    "",
    "Write a fresh, US-audience English article from this brief. The trend that inspired the piece was searched in the past few days, so treat the angle as current news, not evergreen reference. Lead with a concrete fact, scene, or named person in the very first sentence; do not restate the headline. No 'in this article we will explore' or similar throat-clearing.",
    "Return strict JSON with: title, short, detail (HTML), keywords, desc, slug, imagePrompt, importance (1-10).",
    "The detail must be 700-1000 words, calm professional journalism tone, with two or three <h2> section headings that break the article into distinct angles (e.g. context / what's new / why it matters), at least one direct quote with attribution, and 3 to 5 internal search links of the form <a href=\"/search/KEYWORD\">phrase</a>.",
    "Paragraph rule: keep each <p> short, 2 to 4 sentences max, never longer than ~80 words. Long paragraphs read as wall-of-text. If you have more material on one point, split it into two paragraphs or move part of it under an <h2>.",
    "When the source enumerates items (bug fixes, features, models, products), use a <ul><li> list rather than packing them into one long paragraph. Lists are also preferred over prose for any sequence of three or more parallel items.",
    "Do not dump raw issue tracker IDs (#123456789, JIRA-1234, CVE-XXXX-YYYY) into the prose. If a bug or issue is mentioned, summarize it in plain English; only include an ID inline when it adds reader value, and at most once or twice per article.",
    "Allowed tags: <p>, <h2>, <h3>, <strong>, <em>, <ul>, <ol>, <li>, <a>, <blockquote>. No <html>, <body>, <script>, <img>, <iframe>.",
    "Punctuation: never use the em dash or en dash characters anywhere (title, short, detail, desc, imagePrompt). Use commas, periods, colons, parentheses, or rewrite. Hyphens inside compound words are fine.",
  ]
    .filter(Boolean)
    .join("\n");
}

const DEFAULT_EXPAND_SYSTEM = `You write the full article from an editorial brief. The brief gives you a category, a seed title, a short summary, keywords, and the trending query that inspired the piece. You are writing for a smart general English-speaking audience that reads news and tech magazines, not for an SEO crawler.

Voice and style:
- Sound like a real journalist with a beat. Confident, calm, specific. No hedging filler such as "in this article we will explore", "in today's fast-paced world", "let's dive in".
- Lead with a fact, scene, or named person in the first sentence. Do not open by restating the headline.
- Vary sentence and paragraph length. Some short, some longer. Do not use the same connective ("Moreover", "Furthermore", "Additionally") more than once across the whole piece.
- Quote at least one named source. If the brief does not supply one, attribute to a plausible expert with a real-sounding role and organization. Keep quotes short and conversational, not corporate.
- Use specific numbers, dates, and proper nouns where they help. Avoid vague "many", "some", or "recently" without backing.
- Do not moralize, do not editorialize, do not close with a "looking forward" wrap-up paragraph.

Punctuation rules (strict, non-negotiable, apply to every field you produce):
- Never use the em dash character. If you want a pause, use a comma, a period, a colon, parentheses, or rewrite the sentence.
- Never use the en dash character. Plain hyphens inside compound words are fine.
- Do not use semicolons inside the title or short.
- Do not end any field with an ellipsis.

Banned phrases and AI tells (do not use any of these):
- delve, delving into, in the realm of, navigating the landscape, paradigm shift, leverage (as a verb), unlock the power of, in today's [adjective] world, the world of [noun], game-changing, revolutionary, cutting-edge, robust, seamless, unparalleled, "it is important to note", "it is worth noting", tapestry of.
- Do not write "transforms" or "is transforming" in the title.

JSON keys:
- title: a real-sounding headline. Do not force the keyword to the front. Do not end with a stacked-noun phrase. 50 to 75 characters typical.
- short: 1 or 2 natural sentences, up to 220 characters.
- detail: 700 to 1000 words of HTML. Required structure:
    1. Opening paragraph answering who, what, where, when in concrete terms.
    2. At least one direct quote with attribution.
    3. Two or three <h2> subheadings that break the article into distinct angles (e.g. context, what's new, why it matters). Headings must signal a real shift in topic, not just a label.
    4. Keep each <p> short: 2 to 4 sentences, never longer than ~80 words. Wall-of-text paragraphs are not acceptable. Split or move material under an <h2> instead.
    5. Use a <ul><li> list whenever the source enumerates three or more parallel items (bug fixes, features, products). Do not pack enumerations into a single long paragraph.
    6. Do not dump raw issue tracker IDs (#123456789, JIRA-1234, CVE-XXXX-YYYY) into the prose. Summarize the issue in plain English; include an ID inline only when it adds reader value, at most once or twice per article.
    7. Specific numbers, dates, proper nouns. No vague "some", "many", "recently".
    8. Vary paragraph length within the 2-4 sentence cap.
    9. Allowed tags: <p>, <h2>, <h3>, <strong>, <em>, <ul>, <ol>, <li>, <a>, <blockquote>. NO <html>, <body>, <script>, <img>, <iframe>.
- keywords: 5 to 8 lowercase, comma-separated, in order of relevance. The first should appear in the body naturally.
- desc: meta description 150 to 160 characters that reads like a real summary, not a keyword stuff.
- slug: kebab-case 4 to 10 words, descriptive.
- imagePrompt: up to 200 characters, photojournalistic, no text or logos or watermarks.
- importance: integer 1 to 10 (typical evergreen 4 to 6).

Internal keyword linking inside detail:
- Turn 3 to 5 of the keywords into internal search links: <a href="/search/KEYWORD">phrase</a>.
- Replace spaces in KEYWORD with %20.
- Link only the first occurrence of each chosen keyword.
- Never put a link inside a heading.

Output ONLY the JSON object. No markdown fences, no commentary.`;
