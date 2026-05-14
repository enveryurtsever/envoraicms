import "server-only";
import { sql } from "@/lib/db";
import type {
  IngestCategory,
  Rewritten,
  RoutableCategory,
  SourceArticle,
} from "./types";

export async function alreadyIngested(sourceUrl: string): Promise<boolean> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "Contents" WHERE "ContentURL" = ${sourceUrl}
  `;
  return rows[0].c > 0;
}

export async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (n <= 25) {
    const rows = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "Contents" WHERE "ContentSeo" = ${slug}
    `;
    if (rows[0].c === 0) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
  throw new Error(`Cannot find unique slug for ${base}`);
}

export async function insertIngestedContent(args: {
  cat: IngestCategory;
  article: SourceArticle;
  rewritten: Rewritten;
  imagePath: string;
  staggerMinutes: number;
}): Promise<number> {
  const { cat, article, rewritten, imagePath, staggerMinutes } = args;
  const source = article.publisher?.name
    ? JSON.stringify({ title: article.publisher.name, href: article.url })
    : null;
  const homepage = rewritten.importance >= 7;
  const rows = await sql<{ ContentID: number }[]>`
    INSERT INTO "Contents" (
      "FK_CatID","FK_LangID","ContentTitle","ContentShort","ContentDetail",
      "ContentKeywords","ContentDesc","ContentImage","ContentSeo",
      "ContentURL","ContentSource","Homepage","IsActive","IsDeleted",
      "PublishDate","ModifiedDate","CreatedDate","ImagePrompt"
    ) VALUES (
      ${cat.CatID}, 1, ${rewritten.title}, ${rewritten.short}, ${rewritten.detail},
      ${rewritten.keywords}, ${rewritten.desc}, ${imagePath}, ${rewritten.slug},
      ${article.url}, ${source}, ${homepage}, TRUE, FALSE,
      NOW() - (${staggerMinutes} || ' minutes')::interval,
      NOW() - (${staggerMinutes} || ' minutes')::interval,
      NOW(),
      ${rewritten.imagePrompt ?? null}
    )
    RETURNING "ContentID"
  `;
  return rows[0].ContentID;
}

export async function startIngestRun(
  cronId: number | null,
  catId: number | null,
): Promise<number> {
  const rows = await sql<{ RunID: number }[]>`
    INSERT INTO "IngestRuns" ("FK_CronID","FK_CatID","StartedAt")
    VALUES (${cronId}, ${catId}, NOW())
    RETURNING "RunID"
  `;
  return Number(rows[0].RunID);
}

export async function finishIngestRun(
  runId: number,
  args: {
    inserted: number;
    skipped: number;
    errored: number;
    status: string;
    log: string;
  },
): Promise<void> {
  await sql`
    UPDATE "IngestRuns" SET
      "FinishedAt" = NOW(),
      "Inserted"   = ${args.inserted},
      "Skipped"    = ${args.skipped},
      "Errored"    = ${args.errored},
      "Status"     = ${args.status},
      "Log"        = ${args.log}
    WHERE "RunID" = ${runId}
  `;
  // Bump caches that listen on ingest-runs and contents so the dashboard
  // reflects the run + any newly inserted articles on next render.
  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag("ingest-runs");
    if (args.inserted > 0) revalidateTag("contents");
  } catch {
    // Outside of a request context (e.g. systemd cron) revalidateTag is a
    // no-op; ignore.
  }
}

export async function getIngestCategory(catId: number): Promise<IngestCategory | null> {
  const rows = await sql<IngestCategory[]>`
    SELECT "CatID","CatName","CatSeo" FROM "Categories"
    WHERE "CatID" = ${catId} AND "IsActive" = TRUE AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Active categories that the article router can seed trend lookups for and
 *  let the meta-AI route ideas into. Skips categories with neither keywords
 *  nor a usable name (defensive — the seed must produce something searchable).
 *  Order: CatNumber ASC then CatID — same as header rendering. */
export async function listActiveRoutableCategories(
  limit?: number,
): Promise<RoutableCategory[]> {
  const cap = Math.max(1, Math.min(100, limit ?? 50));
  return sql<RoutableCategory[]>`
    SELECT "CatID","CatName","CatSeo","CatKeywords","CatDesc"
    FROM "Categories"
    WHERE "IsActive" = TRUE
      AND "IsDeleted" = FALSE
      AND "CatName" IS NOT NULL
      AND "CatSeo" IS NOT NULL
    ORDER BY "CatNumber" ASC NULLS LAST, "CatID" ASC
    LIMIT ${cap}
  `;
}
