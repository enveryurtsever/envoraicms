import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  IngestCategory,
  Rewritten,
  SourceArticle,
  TextAiProvider,
} from "@/lib/ingest/types";
import { requireApiKey } from "@/lib/ingest/config";
import { getPromptTemplate } from "@/lib/queries/prompts";
import { fixSearchLinks } from "@/lib/ingest/sanitize-links";
import { currentDateContext } from "@/lib/ingest/prompt-context";
import type { TextAIClient } from "./index";

/** TextAIClient adapter for Gemini, used by the multi-provider article
 *  pipeline. The legacy `makeGeminiProvider` (further below) is kept for the
 *  news pipeline. */
export function makeGeminiTextClient(args: {
  apiKey: string;
  config: Record<string, unknown>;
}): TextAIClient {
  const modelName =
    (args.config.model as string | undefined) ?? "gemini-2.5-flash-lite";
  const client = new GoogleGenerativeAI(args.apiKey);
  return {
    name: "gemini",
    async generateJSON<T = unknown>(req: {
      system: string;
      user: string;
      modelOverride?: string;
    }): Promise<T> {
      const model = client.getGenerativeModel({
        model: req.modelOverride ?? modelName,
        generationConfig: { responseMimeType: "application/json" },
      });
      const res = await model.generateContent([
        { text: req.system },
        { text: req.user },
      ]);
      const text = res.response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
      }
    },
  };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);
}

export const REWRITE_SYSTEM = `You rewrite news articles for a US-audience English news site.
Goal: humanized, original prose that passes AI detectors and is SEO-optimized. Do NOT copy sentences verbatim from the source.

FIRST, evaluate whether the source is a real news story worth rewriting. Set skip=true (and leave other fields empty) if ANY of these apply:
- Body is mostly advertising, affiliate promotion, sponsored content, coupons, deals, or product placement
- Body is a listicle of products to buy, "best X deals", shopping roundups, or gift guides
- Body is paywalled stub, cookie/consent notice, "click here to continue", or error page text
- Body is too short / mostly navigation or boilerplate (<500 chars of actual reporting)
- Body is press release / PR fluff with no independent reporting
- Body is explicit NSFW, hate content, or clearly fabricated
Otherwise set skip=false and fill everything.

Return STRICT JSON with these exact keys:
- skip: boolean
- skipReason: short string (only when skip=true, else "")
- importance: integer 1-10 scoring newsworthiness for a general US audience. Be strict (typical trending article = 4-6).
- title: a real, readable headline, 50 to 75 characters typical. RULES:
  * lead with proper nouns, numbers, or a specific event when available. Google click-through prefers concrete specifics.
  * do NOT reuse the original title verbatim; change word order and paraphrase.
  * skip marketing verbs (transforms, revolutionizes, redefines, unleashes, supercharges, game-changing).
  * no clickbait phrases ("You won't believe", "SHOCKING"), no emoji, no ALL-CAPS words except real acronyms.
  * do NOT add the brand or site name as a suffix; the layout adds it.
  * write the way a person would say it. Avoid title-case noun stacks. The keyword does not need to be at the start of the title.
- titleScore: integer 0-100, your honest self-estimate of the title's SEO quality (keyword prominence, specificity, length fit, CTR appeal). Used for monitoring only.
- short: 1-2 sentences summarizing the story (<= 220 chars)
- detail: LONG HTML body, 700-1000 words, structured like a wire-service / Al Jazeera / Reuters feature. Required:
    1. Opening paragraph: who/what/where/when in one tight paragraph. Full names and titles on first mention.
    2. Direct quotes: at least one quoted statement with attribution ("X said", "according to Y"). Quotes inside &ldquo; / &rdquo; or straight quotes.
    3. One <h2> subheading in the middle signaling a thematic shift.
    4. Specific numbers, dates, proper nouns woven throughout. No vague "some", "many", or "recently" without backing.
    5. At least one paragraph of context/background explaining why the story matters.
    6. Vary paragraph length.
    7. Allowed tags: <p>, <h2>, <strong>, <em>, <ul>, <li>, <a>. No <html>, <body>, <script>, <img>, or <iframe>.
- keywords: 5-8 comma-separated, lowercase. Each keyword must literally appear in the detail body. The FIRST keyword is the primary keyword used in the title rule above.
- desc: meta description 150-160 chars, compelling, includes primary keyword
- slug: kebab-case 4-10 words, descriptive, lowercase
- imagePrompt: <= 200 characters, a concrete visual prompt for this news story (photojournalistic style, no text/logos/watermarks). Used ONLY if an image_ai provider is active; else ignored.

Internal keyword linking (IMPORTANT):
- Inside the detail body, turn 3 to 5 of the keywords into internal search links: <a href="/search/KEYWORD">phrase</a>
- Replace spaces in KEYWORD with %20
- Only link the FIRST occurrence of each chosen keyword. Pick named entities (people, places, organizations, events), not generic adjectives.
- Never put a link inside a heading.

Tone: professional journalism. Confident, calm, specific. Report. Do not editorialize. Do not summarize at the end with a "looking forward" wrap-up. Vary sentence and paragraph length. Do not use the same connective ("Moreover", "Furthermore", "Additionally") more than once across the whole piece.

Punctuation rules (strict, non-negotiable, apply to every field you produce):
- Never use the em dash character. If you want a pause, use a comma, a period, a colon, parentheses, or rewrite the sentence.
- Never use the en dash character. Plain hyphens inside compound words are fine.
- Do not end any field with an ellipsis.

Banned phrases and AI tells (do not use any of these): delve, delving into, in the realm of, navigating the landscape, paradigm shift, leverage (as a verb), unlock the power of, in today's [adjective] world, the world of [noun], game-changing, revolutionary, cutting-edge, robust, seamless, unparalleled, "it is important to note", "it is worth noting", tapestry of, transforms or is transforming.`;

export async function makeGeminiProvider(): Promise<TextAiProvider> {
  const key = await requireApiKey("gemini", "text_ai");
  const modelName = (key.config.model as string | undefined) ?? "gemini-2.5-flash-lite";
  const client = new GoogleGenerativeAI(key.plaintext);
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });

  return {
    name: "gemini",
    async rewrite(
      article: SourceArticle,
      cat: IngestCategory,
      fullContent: string | null,
    ): Promise<Rewritten> {
      const bodyText = fullContent
        ? fullContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000)
        : "";
      const systemTemplate = (await getPromptTemplate("ingest_system")) || REWRITE_SYSTEM;
      const prompt = `${currentDateContext()}

Category: ${cat.CatName}
Original title: ${article.title}
Original excerpt: ${article.excerpt ?? ""}
Original body:
${bodyText}

Source keywords: ${article.keywords?.join(", ") ?? ""}
Publisher: ${article.publisher?.name ?? "Unknown"}
URL: ${article.url}

Rewrite this as an original article following the rules above. Return JSON only.`;

      const res = await model.generateContent([
        { text: systemTemplate },
        { text: prompt },
      ]);
      const text = res.response.text();
      let parsed: Rewritten;
      try {
        parsed = JSON.parse(text) as Rewritten;
      } catch {
        throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
      }
      if (parsed.skip) return parsed;
      if (!parsed.title || !parsed.detail || !parsed.slug) {
        throw new Error(
          `Gemini response missing fields: ${JSON.stringify(parsed).slice(0, 200)}`,
        );
      }
      parsed.slug = slugify(parsed.slug);
      parsed.detail = fixSearchLinks(parsed.detail);
      const imp = Number(parsed.importance);
      parsed.importance = Number.isFinite(imp)
        ? Math.max(1, Math.min(10, Math.round(imp)))
        : 5;
      if (parsed.titleScore != null) {
        const ts = Number(parsed.titleScore);
        parsed.titleScore = Number.isFinite(ts) ? Math.max(0, Math.min(100, Math.round(ts))) : undefined;
      }
      return parsed;
    },
  };
}
