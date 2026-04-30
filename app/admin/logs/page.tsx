import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import {
  listAuditLogs,
  countAuditLogs,
  listAuditAreas,
} from "@/lib/queries/audit-logs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const TR_DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmt(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  return TR_DATE.format(dt);
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; area?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const area = sp.area && sp.area !== "all" ? sp.area : null;

  const [rows, total, areas] = await Promise.all([
    listAuditLogs({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, area }),
    countAuditLogs(area),
    listAuditAreas(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="admin-header">
        <h2>Audit Logs</h2>
        <small style={{ color: "#64748b" }}>{total} entries</small>
      </div>

      <div className="card" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link
          href="/admin/logs"
          className={!area ? "btn" : "btn secondary"}
          style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
        >
          All
        </Link>
        {areas.map((a) => (
          <Link
            key={a}
            href={`/admin/logs?area=${encodeURIComponent(a)}`}
            className={area === a ? "btn" : "btn secondary"}
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
          >
            {a}
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={th}>User</th>
              <th style={th}>Joblem</th>
              <th style={th}>Page</th>
              <th style={th}>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No log entries yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.LogID} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={td}>{r.UserName ?? "—"}</td>
                  <td style={td}>{r.Action}</td>
                  <td style={{ ...td, color: "#64748b" }}>{r.Area}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", color: "#475569" }}>
                    {fmt(r.CreatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          {page > 1 ? (
            <Link
              href={`/admin/logs?${new URLSearchParams({
                ...(area ? { area } : {}),
                page: String(page - 1),
              }).toString()}`}
              className="btn secondary"
            >
              ← Previous
            </Link>
          ) : null}
          <span style={{ alignSelf: "center", fontSize: "0.85rem", color: "#64748b" }}>
            Page {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              href={`/admin/logs?${new URLSearchParams({
                ...(area ? { area } : {}),
                page: String(page + 1),
              }).toString()}`}
              className="btn secondary"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const th: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  verticalAlign: "top",
};
