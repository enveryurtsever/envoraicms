import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireApiKey } from "@/lib/ingest/config";
import { getPromptTemplate } from "@/lib/queries/prompts";

export type SuggestField =
  | "title"
  | "short"
  | "desc"
  | "keywords"
  | "detail"
  | "imagePrompt";

export const SUGGEST_FIELDS: readonly SuggestField[] = [
  "title",
  "short",
  "desc",
  "keywords",
  "detail",
  "imagePrompt",
];

export function isSuggestField(v: unknown): v is SuggestField {
  return typeof v === "string" && (SUGGEST_FIELDS as readonly string[]).includes(v);
}

type Ctx = Record<string, string | null | undefined>;

function pair(label: string, v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t ? `${label}: ${t}` : "";
}

function ctxBlock(keys: Array<[string, string | null | undefined]>): string {
  return keys.map(([k, v]) => pair(k, v)).filter(Boolean).join("\n");
}

const SYSTEM = `You are an SEO editor for a US English news site. Reply with ONE JSON object: {"suggestion": string}. No prose, no markdown fences, no trailing commentary.`;

function contextFor(field: SuggestField, ctx: Ctx): string {
  const title = ctx.title;
  const short = ctx.short;
  const detail = ctx.detail;
  const keywords = ctx.keywords;
  const desc = ctx.desc;
  const category = ctx.category;

  switch (field) {
    case "title":
      return ctxBlock([
        ["Category", category],
        ["Current title", title],
        ["Summary", short],
        ["Keywords", keywords],
        ["First 1200 chars of body", (detail ?? "").slice(0, 1200)],
      ]);
    case "short":
      return ctxBlock([
        ["Title", title],
        ["Keywords", keywords],
        ["First 1200 chars of body", (detail ?? "").slice(0, 1200)],
      ]);
    case "desc":
      return ctxBlock([
        ["Title", title],
        ["Summary", short],
        ["Keywords", keywords],
      ]);
    case "keywords":
      return ctxBlock([
        ["Title", title],
        ["Summary", short],
        ["First 1500 chars of body", (detail ?? "").slice(0, 1500)],
      ]);
    case "detail":
      return ctxBlock([
        ["Title", title],
        ["Summary", short],
        ["Meta description", desc],
        ["Keywords", keywords],
        ["Current body (may be partial)", (detail ?? "").slice(0, 4000)],
      ]);
    case "imagePrompt":
      return ctxBlock([
        ["Title", title],
        ["Summary", short],
        ["Keywords", keywords],
      ]);
  }
}

async function buildPrompt(field: SuggestField, ctx: Ctx): Promise<string> {
  // Template comes from the DB; {{CONTEXT}} is replaced with the field-specific context.
  const template = await getPromptTemplate(`suggest_${field}`);
  const context = contextFor(field, ctx);
  return template.includes("{{CONTEXT}}")
    ? template.replace("{{CONTEXT}}", context)
    : `${template}\n\n${context}`;
}

export async function suggestField(field: SuggestField, ctx: Ctx): Promise<string> {
  const key = await requireApiKey("gemini", "text_ai");
  const modelName = (key.config.model as string | undefined) ?? "gemini-2.5-flash-lite";
  const client = new GoogleGenerativeAI(key.plaintext);
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });

  const userPrompt = await buildPrompt(field, ctx);
  const res = await model.generateContent([
    { text: SYSTEM },
    { text: userPrompt },
  ]);
  const text = res.response.text();
  try {
    const parsed = JSON.parse(text) as { suggestion?: unknown };
    if (typeof parsed.suggestion === "string") return parsed.suggestion.trim();
  } catch {
    /* fall through */
  }
  throw new Error(`AI did not return a valid suggestion: ${text.slice(0, 200)}`);
}
