import "server-only";
import { sql } from "@/lib/db";
import type { CronJob, CronJobConfig, CronJobKind, CronJobStatus } from "@/lib/types";

const BASE_COLS = sql`
  "CronID", "JobName",
  COALESCE("Kind", 'news') AS "Kind",
  "FK_CatID", "NewsProvider", "TextAiProvider",
  "ImageAiProvider", "FrequencyCron",
  COALESCE("ArticlesPerRun", 3) AS "ArticlesPerRun",
  COALESCE("Config", '{}'::jsonb) AS "Config",
  "LastRunAt", "LastRunStatus", "LastRunMessage", "NextRunAt",
  COALESCE("IsActive", TRUE) AS "IsActive",
  "CreatedDate"
`;

function normalizeConfig(c: unknown): CronJobConfig {
  if (c && typeof c === "object" && !Array.isArray(c)) return c as CronJobConfig;
  if (typeof c === "string") {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as CronJobConfig;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function normalizeRows(rows: CronJob[]): CronJob[] {
  return rows.map((r) => ({ ...r, Config: normalizeConfig(r.Config) }));
}

export async function listCronJobs(): Promise<CronJob[]> {
  const rows = await sql<CronJob[]>`
    SELECT ${BASE_COLS} FROM "CronJobs"
    WHERE "IsDeleted" = FALSE
    ORDER BY "IsActive" DESC, "CronID" ASC
  `;
  return normalizeRows(rows);
}

export async function listDueCronJobs(now: Date = new Date()): Promise<CronJob[]> {
  const rows = await sql<CronJob[]>`
    SELECT ${BASE_COLS} FROM "CronJobs"
    WHERE "IsActive" = TRUE
      AND "IsDeleted" = FALSE
      AND ("NextRunAt" IS NULL OR "NextRunAt" <= ${now})
    ORDER BY "NextRunAt" ASC NULLS FIRST
  `;
  return normalizeRows(rows);
}

export async function getCronJob(id: number): Promise<CronJob | null> {
  const rows = await sql<CronJob[]>`
    SELECT ${BASE_COLS} FROM "CronJobs"
    WHERE "CronID" = ${id} AND "IsDeleted" = FALSE LIMIT 1
  `;
  return rows[0] ? normalizeRows([rows[0]])[0] : null;
}

export async function createCronJob(data: {
  jobName: string;
  kind: CronJobKind;
  catId: number | null;
  newsProvider: string | null;
  textAiProvider: string | null;
  imageAiProvider: string | null;
  frequencyCron: string;
  articlesPerRun: number;
  config?: CronJobConfig;
  isActive: boolean;
  nextRunAt: Date | null;
  creatorId?: number | null;
}): Promise<number> {
  const rows = await sql<{ CronID: number }[]>`
    INSERT INTO "CronJobs" (
      "JobName","Kind","FK_CatID","NewsProvider","TextAiProvider","ImageAiProvider",
      "FrequencyCron","ArticlesPerRun","Config","IsActive","NextRunAt","Fk_UserID"
    ) VALUES (
      ${data.jobName}, ${data.kind}, ${data.catId},
      ${data.newsProvider}, ${data.textAiProvider},
      ${data.imageAiProvider}, ${data.frequencyCron}, ${data.articlesPerRun},
      ${sql.json((data.config ?? {}) as never)},
      ${data.isActive}, ${data.nextRunAt}, ${data.creatorId ?? null}
    )
    RETURNING "CronID"
  `;
  return rows[0].CronID;
}

export async function updateCronJob(
  id: number,
  data: Partial<{
    jobName: string;
    kind: CronJobKind;
    catId: number | null;
    newsProvider: string | null;
    textAiProvider: string | null;
    imageAiProvider: string | null;
    frequencyCron: string;
    articlesPerRun: number;
    config: CronJobConfig;
    isActive: boolean;
    nextRunAt: Date | null;
  }>,
): Promise<void> {
  await sql`
    UPDATE "CronJobs" SET
      "JobName"         = COALESCE(${data.jobName ?? null}, "JobName"),
      "Kind"            = COALESCE(${data.kind ?? null}, "Kind"),
      "FK_CatID"        = ${data.catId ?? null},
      "NewsProvider"    = ${data.newsProvider ?? null},
      "TextAiProvider"  = ${data.textAiProvider ?? null},
      "ImageAiProvider" = ${data.imageAiProvider ?? null},
      "FrequencyCron"   = COALESCE(${data.frequencyCron ?? null}, "FrequencyCron"),
      "ArticlesPerRun"  = COALESCE(${data.articlesPerRun ?? null}, "ArticlesPerRun"),
      "Config"          = COALESCE(${data.config ? sql.json(data.config as never) : null}, "Config"),
      "IsActive"        = COALESCE(${data.isActive ?? null}, "IsActive"),
      "NextRunAt"       = ${data.nextRunAt ?? null}
    WHERE "CronID" = ${id}
  `;
}

export async function markCronRun(
  id: number,
  status: CronJobStatus,
  message: string | null,
  nextRunAt: Date | null,
): Promise<void> {
  await sql`
    UPDATE "CronJobs" SET
      "LastRunAt"      = NOW(),
      "LastRunStatus"  = ${status},
      "LastRunMessage" = ${message},
      "NextRunAt"      = ${nextRunAt}
    WHERE "CronID" = ${id}
  `;
}

export async function softDeleteCronJob(id: number): Promise<void> {
  await sql`UPDATE "CronJobs" SET "IsDeleted" = TRUE, "IsActive" = FALSE WHERE "CronID" = ${id}`;
}
