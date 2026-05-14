import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import {
  normalizeTz,
  startOfDayInTz,
  startOfWeekInTz,
  startOfMonthInTz,
  startOfYearInTz,
} from "@/lib/dates/tz";

export type DateRange = "today" | "week" | "month" | "year";

export const RANGE_LABEL: Record<DateRange, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
};

export function isDateRange(v: unknown): v is DateRange {
  return v === "today" || v === "week" || v === "month" || v === "year";
}

// Calendar-based "since" timestamp for the given range, in the admin's
// reported IANA timezone (eg. "Europe/Istanbul"). Returns a UTC `Date` since
// the DB stores UTC; the moment represents 00:00 in the target tz.
function rangeSince(range: DateRange, tz: string): Date {
  const now = new Date();
  if (range === "today") return startOfDayInTz(now, tz);
  if (range === "week") return startOfWeekInTz(now, tz);
  if (range === "month") return startOfMonthInTz(now, tz);
  return startOfYearInTz(now, tz);
}

export type DashboardStats = {
  range: DateRange;
  totalContents: number;
  activeContents: number;
  contentsInRange: number;
  totalCategories: number;
  activeCronJobs: number;
  ingestInRange: { runs: number; inserted: number; errored: number };
  falAiInRange: number;
  perCategoryInRange: { CatName: string; count: number }[];
  recentRuns: {
    RunID: number;
    CatName: string | null;
    StartedAt: string;
    Status: string | null;
    Inserted: number;
    Skipped: number;
    Errored: number;
  }[];
  upcomingJobs: {
    CronID: number;
    JobName: string;
    NextRunAt: string | null;
  }[];
  recentActivity: {
    LogID: number;
    UserName: string | null;
    Action: string;
    Area: string;
    CreatedAt: string;
  }[];
};

/** Dashboard stats are cached for 60s, keyed by (range, tz) so each admin's
 *  local calendar gets its own bucket. Invalidated whenever any
 *  Contents/Categories/CronJobs/IngestRuns/AuditLogs row is touched (those
 *  domains revalidate their tags on every insert/update). */
export async function getDashboardStats(
  range: DateRange = "today",
  tz: string = "UTC",
): Promise<DashboardStats> {
  return loadDashboardStats(range, normalizeTz(tz));
}

const loadDashboardStats = unstable_cache(
  async (range: DateRange, tz: string): Promise<DashboardStats> => {
    return computeDashboardStats(range, tz);
  },
  ["dashboard-stats"],
  {
    revalidate: 60,
    tags: ["contents", "categories", "cronjobs", "audit-logs", "ingest-runs"],
  },
);

async function computeDashboardStats(range: DateRange, tz: string): Promise<DashboardStats> {
  const since = rangeSince(range, tz);

  const [
    contentTotals,
    contentInRange,
    catTotals,
    cronTotals,
    ingestAgg,
    perCat,
    recent,
    falAi,
    upcoming,
    activity,
  ] = (await Promise.all([
    sql<{ total: number; active: number }[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE "IsActive" = TRUE)::int AS active
      FROM "Contents" WHERE "IsDeleted" = FALSE
    `,
    sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "Contents"
      WHERE "IsDeleted" = FALSE AND "CreatedDate" >= ${since}
    `,
    sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "Categories"
      WHERE "IsDeleted" = FALSE AND "IsActive" = TRUE
    `,
    sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM "CronJobs"
      WHERE "IsDeleted" = FALSE AND "IsActive" = TRUE
    `,
    sql<{ runs: number; inserted: number; errored: number }[]>`
      SELECT COUNT(*)::int AS runs,
             COALESCE(SUM("Inserted"), 0)::int AS inserted,
             COALESCE(SUM("Errored"), 0)::int AS errored
      FROM "IngestRuns"
      WHERE "StartedAt" >= ${since}
    `,
    sql<{ CatName: string; count: number }[]>`
      SELECT c."CatName", COUNT(*)::int AS count
      FROM "Contents" ct
      JOIN "Categories" c ON c."CatID" = ct."FK_CatID"
      WHERE ct."IsDeleted" = FALSE
        AND ct."CreatedDate" >= ${since}
      GROUP BY c."CatName"
      ORDER BY count DESC
      LIMIT 10
    `,
    sql<{
      RunID: number;
      CatName: string | null;
      StartedAt: string;
      Status: string | null;
      Inserted: number;
      Skipped: number;
      Errored: number;
    }[]>`
      SELECT r."RunID", c."CatName", r."StartedAt"::text AS "StartedAt",
             r."Status", r."Inserted", r."Skipped", r."Errored"
      FROM "IngestRuns" r
      LEFT JOIN "Categories" c ON c."CatID" = r."FK_CatID"
      ORDER BY r."StartedAt" DESC
      LIMIT 10
    `,
    // Count actual `[falai]` occurrences across each run's Log (one tag per
    // successful image), not just "runs that mention falai" — otherwise a
    // run that produced 20 images was being scored as 1.
    sql<{ c: number }[]>`
      SELECT COALESCE(SUM(
        (LENGTH("Log") - LENGTH(REPLACE("Log", '[falai]', '')))
        / LENGTH('[falai]')
      ), 0)::int AS c
      FROM "IngestRuns"
      WHERE "StartedAt" >= ${since}
    `,
    sql<{ CronID: number; JobName: string; NextRunAt: string | null }[]>`
      SELECT "CronID", "JobName", "NextRunAt"::text AS "NextRunAt"
      FROM "CronJobs"
      WHERE "IsDeleted" = FALSE AND "IsActive" = TRUE AND "NextRunAt" IS NOT NULL
      ORDER BY "NextRunAt" ASC
      LIMIT 5
    `,
    sql<{
      LogID: number;
      UserName: string | null;
      Action: string;
      Area: string;
      CreatedAt: string;
    }[]>`
      SELECT "LogID", "UserName", "Action", "Area", "CreatedAt"::text AS "CreatedAt"
      FROM "AuditLogs"
      ORDER BY "CreatedAt" DESC
      LIMIT 8
    `,
  ])) as [
    { total: number; active: number }[],
    { c: number }[],
    { c: number }[],
    { c: number }[],
    { runs: number; inserted: number; errored: number }[],
    { CatName: string; count: number }[],
    {
      RunID: number;
      CatName: string | null;
      StartedAt: string;
      Status: string | null;
      Inserted: number;
      Skipped: number;
      Errored: number;
    }[],
    { c: number }[],
    { CronID: number; JobName: string; NextRunAt: string | null }[],
    {
      LogID: number;
      UserName: string | null;
      Action: string;
      Area: string;
      CreatedAt: string;
    }[],
  ];

  return {
    range,
    totalContents: contentTotals[0]?.total ?? 0,
    activeContents: contentTotals[0]?.active ?? 0,
    contentsInRange: contentInRange[0]?.c ?? 0,
    totalCategories: catTotals[0]?.c ?? 0,
    activeCronJobs: cronTotals[0]?.c ?? 0,
    ingestInRange: {
      runs: ingestAgg[0]?.runs ?? 0,
      inserted: ingestAgg[0]?.inserted ?? 0,
      errored: ingestAgg[0]?.errored ?? 0,
    },
    falAiInRange: falAi[0]?.c ?? 0,
    perCategoryInRange: perCat,
    recentRuns: recent,
    upcomingJobs: upcoming,
    recentActivity: activity,
  };
}
