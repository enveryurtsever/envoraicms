import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDashboardStats, isDateRange, RANGE_LABEL, type DateRange } from "@/lib/queries/stats";
import { getPreflight } from "@/lib/queries/preflight";
import { LocalDate } from "@/components/admin-ui/LocalDate";
import {
  IconNewspaper,
  IconSparkle,
  IconFolder,
  IconClock,
  IconBolt,
  IconImage,
} from "@/components/admin-ui/Icon";
import { RangeSelector } from "./RangeSelector";

export const metadata = { title: "Dashboard" };

function statusBadge(status: string | null) {
  if (!status) return <span className="badge off">unknown</span>;
  if (status === "ok") return <span className="badge ok">ok</span>;
  if (status === "error") return <span className="badge err">error</span>;
  return <span className="badge off">{status}</span>;
}

type TileKey =
  | "totalContents"
  | "contentsInRange"
  | "totalCategories"
  | "activeCronJobs"
  | "ingestRunsInRange"
  | "falAiInRange";

type Tile = {
  label: string;
  key: TileKey;
  Icon: (p: { size?: number }) => React.ReactNode;
  from: string;
  to: string;
  soft: string;
  href?: string;
  rangeAware?: boolean;
};

const TILES: Tile[] = [
  { label: "Total content",     key: "totalContents",      Icon: IconNewspaper, from: "#2563eb", to: "#6366f1", soft: "#eff6ff", href: "/admin/contents" },
  { label: "{range} content",   key: "contentsInRange",    Icon: IconSparkle,   from: "#16a34a", to: "#22c55e", soft: "#dcfce7", rangeAware: true },
  { label: "Active categories", key: "totalCategories",    Icon: IconFolder,    from: "#f59e0b", to: "#fb923c", soft: "#fef3c7", href: "/admin/categories" },
  { label: "Active cron jobs",  key: "activeCronJobs",     Icon: IconClock,     from: "#8b5cf6", to: "#a855f7", soft: "#f3e8ff", href: "/admin/cronjobs" },
  { label: "{range} ingest runs", key: "ingestRunsInRange", Icon: IconBolt,     from: "#0ea5e9", to: "#06b6d4", soft: "#e0f2fe", href: "/admin/logs", rangeAware: true },
  { label: "{range} AI images", key: "falAiInRange",       Icon: IconImage,     from: "#ec4899", to: "#f472b6", soft: "#fce7f3", rangeAware: true },
];

/** Render the page shell synchronously; defer every DB-bound section to its
 *  own Suspense so the page paints immediately and content streams in. */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range: DateRange = isDateRange(sp.range) ? sp.range : "today";
  const tz = (await cookies()).get("admin_tz")?.value ?? "UTC";

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Dashboard</h2>
          <div className="subtitle">
            Site-wide health and recent activity at a glance.
          </div>
        </div>
        <div className="actions">
          <RangeSelector active={range} />
        </div>
      </div>

      <Suspense fallback={null}>
        <PreflightBanner />
      </Suspense>

      <Suspense fallback={<TilesSkeleton />}>
        <DashboardData range={range} tz={tz} />
      </Suspense>
    </>
  );
}

async function PreflightBanner() {
  const preflight = await getPreflight();
  if (preflight.ok) return null;
  return (
    <div
      className="card"
      style={{
        border: "1px solid #fecaca",
        background: "#fef2f2",
        padding: "1rem 1.1rem",
        marginBottom: "1.25rem",
      }}
      role="alert"
    >
      <div style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: "#dc2626",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          !
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "#991b1b" }}>Configuration required</div>
          <div style={{ fontSize: "0.875rem", color: "#7f1d1d", marginTop: 2 }}>
            Automation is paused until Settings and API keys are completed.
          </div>
          <ul style={{ margin: "0.6rem 0 0 1.1rem", padding: 0, fontSize: "0.85rem", color: "#7f1d1d" }}>
            {preflight.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.5rem" }}>
            <Link href="/admin/settings" className="btn small">Open Settings</Link>
            <Link href="/admin/apikeys" className="btn secondary small">Open API Keys</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

async function DashboardData({ range, tz }: { range: DateRange; tz: string }) {
  const stats = await getDashboardStats(range, tz);
  const rangeLabel = RANGE_LABEL[range];

  const values: Record<TileKey, number> = {
    totalContents: stats.totalContents,
    contentsInRange: stats.contentsInRange,
    totalCategories: stats.totalCategories,
    activeCronJobs: stats.activeCronJobs,
    ingestRunsInRange: stats.ingestInRange.runs,
    falAiInRange: stats.falAiInRange,
  };

  return (
    <>
      <div className="stat-grid">
        {TILES.map((t) => {
          const value = values[t.key];
          const label = t.rangeAware ? t.label.replace("{range}", rangeLabel) : t.label;
          const tile = (
            <>
              <div
                className="stat__icon"
                style={
                  {
                    "--accent-from": t.from,
                    "--accent-to": t.to,
                    "--accent-soft": t.soft,
                  } as React.CSSProperties
                }
              >
                <t.Icon size={20} />
              </div>
              <div className="label">{label}</div>
              <div className="value">{value.toLocaleString(undefined)}</div>
              {t.key === "ingestRunsInRange" ? (
                <div className="sub">
                  {stats.ingestInRange.inserted} inserted · {stats.ingestInRange.errored} errors
                </div>
              ) : null}
              {t.key === "totalContents" ? (
                <div className="sub">
                  {stats.activeContents.toLocaleString(undefined)} active
                </div>
              ) : null}
            </>
          );
          const className = "stat stat--accent";
          const style = { "--accent-from": t.from, "--accent-to": t.to } as React.CSSProperties;
          return t.href ? (
            <Link key={t.key} href={t.href} className={className} style={style}>
              {tile}
            </Link>
          ) : (
            <div key={t.key} className={className} style={style}>
              {tile}
            </div>
          );
        })}
      </div>

      <div className="section-grid" style={{ marginTop: "1.25rem" }}>
        <div className="card">
          <h3>Recent ingest runs</h3>
          {stats.recentRuns.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>No runs yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>+/skip/err</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentRuns.map((r) => (
                  <tr key={r.RunID}>
                    <td><LocalDate value={r.StartedAt} mode="relative" /></td>
                    <td>{r.CatName ?? "—"}</td>
                    <td>{statusBadge(r.Status)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {r.Inserted}/{r.Skipped}/{r.Errored}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card">
            <h3>Upcoming cron jobs</h3>
            {stats.upcomingJobs.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
                No active cron jobs scheduled.
              </p>
            ) : (
              <ul className="activity-list">
                {stats.upcomingJobs.map((j) => (
                  <li key={j.CronID}>
                    <span className="pin" style={{ background: "#8b5cf6" }} />
                    <Link href={`/admin/cronjobs`} className="who">
                      {j.JobName}
                    </Link>
                    <span className="when">
                      <LocalDate value={j.NextRunAt} mode="relative" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3>Recent activity</h3>
            {stats.recentActivity.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
                No audit log entries yet.
              </p>
            ) : (
              <ul className="activity-list">
                {stats.recentActivity.map((a) => (
                  <li key={a.LogID}>
                    <span className="pin" style={{ background: areaColor(a.Area) }} />
                    <span>
                      <span className="who">{a.UserName ?? "system"}</span>{" "}
                      <span className="what">{a.Action}</span>{" "}
                      <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>· {a.Area}</span>
                    </span>
                    <span className="when">
                      <LocalDate value={a.CreatedAt} mode="relative" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {stats.perCategoryInRange.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Ingest by category — {rangeLabel.toLowerCase()}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ textAlign: "right" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {stats.perCategoryInRange.map((r) => (
                <tr key={r.CatName}>
                  <td>{r.CatName}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function TilesSkeleton() {
  return (
    <>
      <div className="stat-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat" style={{ minHeight: 96 }}>
            <div className="adm-skel" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <div className="adm-skel adm-skel-row" style={{ width: "60%" }} />
            <div className="adm-skel" style={{ height: "1.6rem", width: "40%" }} />
          </div>
        ))}
      </div>
      <div className="section-grid" style={{ marginTop: "1.25rem" }}>
        <div className="card">
          <div className="adm-skel adm-skel-title" />
          <div className="adm-skel adm-skel-row" />
          <div className="adm-skel adm-skel-row" />
          <div className="adm-skel adm-skel-row" />
        </div>
        <div className="card">
          <div className="adm-skel adm-skel-title" />
          <div className="adm-skel adm-skel-row" />
          <div className="adm-skel adm-skel-row" />
        </div>
      </div>
    </>
  );
}

function areaColor(area: string): string {
  switch (area) {
    case "auth": return "#2563eb";
    case "contents": return "#16a34a";
    case "categories": return "#f59e0b";
    case "users": return "#8b5cf6";
    case "cronjobs": return "#0ea5e9";
    case "settings": return "#475569";
    case "apikeys": return "#dc2626";
    case "ads": return "#ec4899";
    default: return "#94a3b8";
  }
}
