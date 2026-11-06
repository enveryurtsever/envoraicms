import "server-only";
import { sql } from "@/lib/db";
import { getActiveTextAI } from "@/lib/ingest/providers/text";
import { getSettings } from "@/lib/queries/settings";
import { similarity, tokenize } from "./checks";
import { runGate, type DuplicateCandidate, type GateOutcome, type GateSource } from "./engine";

export type { GateOutcome, GateSource } from "./engine";

const POSSIBLE_DUPLICATE = 0.3;

async function findDuplicateCandidates(
  title: string,
  keywords: string,
  windowDays: number,
): Promise<DuplicateCandidate[]> {
  const rows = await sql<{ ContentID: number; ContentTitle: string; ContentKeywords: string | null }[]>`
    SELECT "ContentID", "ContentTitle", "ContentKeywords"
    FROM "Contents"
    WHERE "IsDeleted" = FALSE
      AND "ContentTitle" IS NOT NULL
      AND "CreatedDate" >= NOW() - (${windowDays} || ' days')::interval
    ORDER BY "CreatedDate" DESC
    LIMIT 5000
  `;
  const titleTokens = tokenize(title);
  const allTokens = tokenize(`${title} ${keywords}`);
  return rows
    .map((row) => ({
      ContentID: row.ContentID,
      ContentTitle: row.ContentTitle,
      score: Math.max(
        similarity(titleTokens, tokenize(row.ContentTitle)),
        similarity(allTokens, tokenize(`${row.ContentTitle} ${row.ContentKeywords ?? ""}`)),
      ),
    }))
    .filter((row) => row.score >= POSSIBLE_DUPLICATE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/** Loads what the publishing checks need and runs them. */
export async function evaluateForPublish(input: {
  title: string;
  detail: string;
  keywords: string;
  categoryName: string;
  sources: GateSource[];
}): Promise<GateOutcome> {
  const settings = await getSettings();
  if (!settings.ReviewGateEnabled) {
    return { status: "passed", title: input.title, detail: input.detail, notes: [] };
  }
  const [writer, verifier, candidates] = await Promise.all([
    getActiveTextAI("content"),
    getActiveTextAI("meta"),
    findDuplicateCandidates(input.title, input.keywords, Math.max(1, settings.DuplicateWindowDays)),
  ]);
  return runGate(input, {
    writer,
    verifier,
    siteName: settings.SiteName,
    siteDescription: settings.Description,
    candidates,
  });
}
