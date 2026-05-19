import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  IngestCategory,
  NewsNowArticle,
  RewrittenWithCategory,
} from "@/lib/ingest/types";
import { requireApiKey } from "@/lib/ingest/config";
import { getPromptTemplate } from "@/lib/queries/prompts";
import { REWRITE_SYSTEM } from "@/lib/ingest/providers/text/gemini";
import { fixSearchLinks } from "@/lib/ingest/sanitize-links";
import { currentDateContext } from "@/lib/ingest/prompt-context";
import { getSettings } from "@/lib/queries/settings";
import {
  languageEnglishName,
  locationEnglishName,
} from "@/lib/site-language";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function strip(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const CATEGORY_INSTRUCTIONS = `

CATEGORY SELECTION:
- You will be given a list of site categories with their slugs.
- Pick the SINGLE most appropriate slug from that list and return it as
  "categorySlug". The slug MUST match one of the provided values exactly.
- If none of the categories fits the story (e.g. the article is clearly
  off-topic for this site), return categorySlug: null AND set skip: true with
  skipReason: "no matching category".
- Add a short "categoryReason" string explaining the choice (1 sentence,
  <= 120 chars). It is shown in the admin draft list for transparency.
`;

export async function rewriteWithCategory(args: {
  article: NewsNowArticle;
  categories: IngestCategory[];
  hintCategory?: string | null;
}): Promise<RewrittenWithCategory> {
  const { article, categories } = args;

  const key = await requireApiKey("gemini", "text_ai");
  const modelName = (key.config.model as string | undefined) ?? "gemini-2.5-flash-lite";
  const client = new GoogleGenerativeAI(key.plaintext);
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });

  const settings = await getSettings();
  const languageName = languageEnglishName(settings.SiteLanguage);
  const countryName = locationEnglishName(settings.SiteLocation);

  const baseTemplate = (await getPromptTemplate("ingest_system")) || REWRITE_SYSTEM;
  const systemPrompt = (baseTemplate + CATEGORY_INSTRUCTIONS)
    .replace(/\{language\}/g, languageName)
    .replace(/\{country\}/g, countryName);

  const categoryList = categories
    .map((c) => `- ${c.CatSeo} :: ${c.CatName}`)
    .join("\n");

  const bodyText = strip(article.text ?? article.excerpt ?? "", 8000);
  const userPrompt = `${currentDateContext()}

Output language: ${languageName}. Target audience: readers in ${countryName}.

Site categories (slug :: name) — pick exactly one slug:
${categoryList || "(none defined)"}
${args.hintCategory ? `Provider hint category: ${args.hintCategory}` : ""}

Original title: ${article.title}
Original excerpt: ${article.excerpt ?? ""}
Original body:
${bodyText}

Publisher: ${article.publisher?.name ?? "Unknown"}
URL: ${article.url}

Rewrite this as an original article in ${languageName} AND pick the best site
category from the list above. Return JSON only.`;

  const res = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt },
  ]);
  const text = res.response.text();
  let parsed: RewrittenWithCategory;
  try {
    parsed = JSON.parse(text) as RewrittenWithCategory;
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }

  if (parsed.skip) {
    return {
      ...parsed,
      categorySlug: parsed.categorySlug ?? null,
    };
  }

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
    parsed.titleScore = Number.isFinite(ts)
      ? Math.max(0, Math.min(100, Math.round(ts)))
      : undefined;
  }

  // Validate categorySlug against the allowlist.
  if (parsed.categorySlug) {
    const allowed = new Set(categories.map((c) => c.CatSeo));
    if (!allowed.has(parsed.categorySlug)) {
      // Try a forgiving lowercase match; otherwise null it.
      const lower = parsed.categorySlug.toLowerCase();
      const match = categories.find((c) => c.CatSeo.toLowerCase() === lower);
      parsed.categorySlug = match ? match.CatSeo : null;
    }
  } else {
    parsed.categorySlug = null;
  }

  return parsed;
}
