"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VersionStatus } from "@/lib/system/version";
import type { UpdateJob, Step } from "@/lib/system/update-job";

type Props = {
  initialStatus: VersionStatus;
  initialJob: UpdateJob | null;
  updaterEnabled: boolean;
};

const STEP_DOT: Record<Step["status"], { color: string; glyph: string }> = {
  pending:  { color: "#cbd5e1", glyph: "·" },
  running:  { color: "#2563eb", glyph: "→" },
  done:     { color: "#16a34a", glyph: "✓" },
  failed:   { color: "#dc2626", glyph: "✕" },
  skipped:  { color: "#94a3b8", glyph: "—" },
};

export function UpdateClient({ initialStatus, initialJob, updaterEnabled }: Props) {
  const [status, setStatus] = useState<VersionStatus>(initialStatus);
  const [job, setJob] = useState<UpdateJob | null>(initialJob);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);

  const isRunning = job?.status === "running";

  // Poll job state while running.
  useEffect(() => {
    if (!isRunning) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/system/update", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { job: UpdateJob | null };
          if (!stopped && data.job) setJob(data.job);
        } else if (res.status === 502 || res.status === 503 || res.status === 504) {
          // Likely a pm2 reload in flight — keep retrying.
        }
      } catch {
        /* network blip during reload — ignore */
      }
    };
    const id = setInterval(tick, 1500);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [isRunning]);

  // Auto-scroll log to bottom on new entries.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log.length]);

  // After a successful update, the server will reload via pm2. Auto-refresh
  // the page after a short grace period so the new version's UI loads.
  useEffect(() => {
    if (job?.status !== "success") return;
    const t = setTimeout(() => window.location.reload(), 8000);
    return () => clearTimeout(t);
  }, [job?.status]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system/version?force=1", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as VersionStatus;
      setStatus(data);
      if (data.warning) {
        setError("Could not reach the release repository. Please try again later.");
      }
    } catch {
      setError("Could not reach the release repository. Please try again later.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const startUpdate = useCallback(async () => {
    setStarting(true);
    setError(null);
    setConfirmOpen(false);
    try {
      const res = await fetch("/api/admin/system/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag: status.latest?.tag }),
      });
      const data = (await res.json()) as { job?: UpdateJob; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.job) setJob(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not start update");
    } finally {
      setStarting(false);
    }
  }, [status.latest?.tag]);

  const lastChecked = useMemo(
    () => new Date(status.fetchedAt).toLocaleString(),
    [status.fetchedAt],
  );

  return (
    <>
      {!updaterEnabled ? (
        <div
          className="card"
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            padding: "0.9rem 1rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ fontWeight: 600, color: "#854d0e" }}>Updater is disabled</div>
          <div style={{ fontSize: "0.85rem", color: "#78350f", marginTop: 2 }}>
            Add <code>UPDATER_ENABLED=true</code> to <code>.env.local</code> and restart
            the server to enable in-place updates from this page. Without it the page is
            read-only — version detection still works.
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 140 }}>
            <div style={labelStyle}>Current version</div>
            <div style={bigStyle}>v{status.current}</div>
          </div>
          <div style={{ minWidth: 140 }}>
            <div style={labelStyle}>Latest release</div>
            <div style={bigStyle}>
              {status.latest ? status.latest.tag : "—"}
            </div>
            {status.latest?.publishedAt ? (
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {new Date(status.latest.publishedAt).toLocaleDateString()}
              </div>
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={labelStyle}>Status</div>
            <div style={{ fontSize: "0.95rem", marginTop: 4 }}>
              {status.warning ? (
                <span style={{ color: "#b45309" }}>
                  Could not reach the release repository. Please try again later.
                </span>
              ) : !status.latest ? (
                <span style={{ color: "#64748b" }}>No releases published yet.</span>
              ) : status.hasUpdate ? (
                <span style={{ color: "#16a34a", fontWeight: 600 }}>
                  Update available
                </span>
              ) : (
                <span style={{ color: "#64748b" }}>You are on the latest release.</span>
              )}
            </div>
            {status.warning ? (
              <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>
                Details: {status.warning}
              </div>
            ) : null}
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
              Checked {lastChecked}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <button
              type="button"
              className="btn secondary small"
              onClick={refresh}
              disabled={refreshing || isRunning}
            >
              {refreshing ? "Checking…" : "Check now"}
            </button>
            {status.latest ? (
              <a
                className="btn secondary small"
                href={status.latest.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Release notes ↗
              </a>
            ) : null}
            <button
              type="button"
              className="btn small"
              onClick={() => setConfirmOpen(true)}
              disabled={
                !updaterEnabled ||
                !status.hasUpdate ||
                isRunning ||
                starting
              }
            >
              {isRunning ? "Updating…" : "Backup & update"}
            </button>
          </div>
        </div>

        {error ? (
          <div style={{ marginTop: "0.8rem", color: "#dc2626", fontSize: "0.85rem" }}>
            {error}
          </div>
        ) : null}

        {status.latest?.notes ? (
          <details style={{ marginTop: "1rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
              Release notes — {status.latest.name}
            </summary>
            <pre
              style={{
                marginTop: "0.5rem",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "0.7rem 0.9rem",
                fontSize: "0.78rem",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
                color: "#334155",
                maxHeight: 280,
                overflow: "auto",
              }}
            >
              {status.latest.notes}
            </pre>
          </details>
        ) : null}
      </div>

      {job ? (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ margin: 0 }}>
              {job.status === "running" ? "Update in progress" :
               job.status === "success" ? "Update completed" :
               "Update failed"}
            </h3>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              v{job.fromVersion} → {job.tag}
            </div>
          </div>

          <ol style={{ listStyle: "none", padding: 0, margin: "0.9rem 0 0" }}>
            {job.steps.map((s) => {
              const dot = STEP_DOT[s.status];
              const dur =
                s.startedAt && s.endedAt
                  ? `${((s.endedAt - s.startedAt) / 1000).toFixed(1)}s`
                  : s.startedAt
                  ? `${((Date.now() - s.startedAt) / 1000).toFixed(0)}s`
                  : "";
              return (
                <li
                  key={s.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.35rem 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.72rem",
                      color: "#fff",
                      background: dot.color,
                      fontWeight: 600,
                    }}
                  >
                    {dot.glyph}
                  </span>
                  <span style={{ flex: 1, fontSize: "0.85rem" }}>{s.label}</span>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8", minWidth: 40, textAlign: "right" }}>
                    {dur}
                  </span>
                </li>
              );
            })}
          </ol>

          {job.error ? (() => {
            const rb = job.steps.find((s) => s.key === "rollback");
            const rolledBack = rb?.status === "done";
            const rollbackFailed = rb?.status === "failed";
            const rollbackRunning = rb?.status === "running";
            return (
              <div
                style={{
                  marginTop: "0.8rem",
                  padding: "0.7rem 0.9rem",
                  background: rolledBack ? "#fffbeb" : "#fef2f2",
                  border: `1px solid ${rolledBack ? "#fde68a" : "#fecaca"}`,
                  borderRadius: 8,
                  color: rolledBack ? "#92400e" : "#991b1b",
                  fontSize: "0.83rem",
                }}
              >
                <strong>Error:</strong> {job.error}
                {rollbackRunning ? (
                  <div style={{ marginTop: 4, fontSize: "0.78rem" }}>
                    Rolling back to v{job.fromVersion}… the site is held on the
                    old code while this completes.
                  </div>
                ) : rolledBack ? (
                  <div style={{ marginTop: 4, fontSize: "0.78rem" }}>
                    Auto-rolled back to v{job.fromVersion}. The site keeps
                    running on the previous version; DB backup at{" "}
                    <code>{job.backupDir}</code>.
                  </div>
                ) : rollbackFailed ? (
                  <div style={{ marginTop: 4, fontSize: "0.78rem" }}>
                    Auto-rollback also failed. Recover manually: <code>cd</code>{" "}
                    to the install dir, then{" "}
                    <code>git reset --hard {job.fromSha.slice(0, 12) || job.fromVersion}</code>,{" "}
                    <code>npm ci --include=dev</code>,{" "}
                    <code>npm run migrate</code>,{" "}
                    <code>npm run build</code>,{" "}
                    <code>pm2 reload {job.pm2AppName || "envoraicms"}</code>. DB backup at{" "}
                    <code>{job.backupDir}</code>.
                  </div>
                ) : job.backupDir ? (
                  <div style={{ marginTop: 4, fontSize: "0.78rem" }}>
                    Backup saved to <code>{job.backupDir}</code>.
                  </div>
                ) : null}
              </div>
            );
          })() : null}

          {job.status === "success" ? (
            <div
              style={{
                marginTop: "0.8rem",
                padding: "0.7rem 0.9rem",
                background: "#dcfce7",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                color: "#166534",
                fontSize: "0.83rem",
              }}
            >
              Reloading via PM2… this page will refresh shortly. Backup at{" "}
              <code>{job.backupDir}</code>
            </div>
          ) : null}

          <details style={{ marginTop: "0.8rem" }} open={job.status !== "success"}>
            <summary style={{ cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 }}>
              Log ({job.log.length} lines)
            </summary>
            <pre
              ref={logRef}
              style={{
                marginTop: "0.5rem",
                background: "#0b1020",
                color: "#e2e8f0",
                border: "1px solid #1e293b",
                borderRadius: 8,
                padding: "0.7rem 0.9rem",
                fontSize: "0.74rem",
                lineHeight: 1.55,
                maxHeight: 360,
                overflow: "auto",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                whiteSpace: "pre-wrap",
              }}
            >
              {job.log.map((l, i) => (
                <div key={i} style={{ color: l.level === "error" ? "#fca5a5" : undefined }}>
                  {new Date(l.ts).toLocaleTimeString()} {l.line}
                </div>
              ))}
            </pre>
          </details>
        </div>
      ) : null}

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "1.2rem 1.4rem",
              maxWidth: 460,
              width: "calc(100% - 2rem)",
              boxShadow: "0 10px 40px rgba(15,23,42,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 0.6rem" }}>Confirm update</h3>
            <p style={{ fontSize: "0.88rem", color: "#475569", lineHeight: 1.5 }}>
              This will take a database backup, then update the code to{" "}
              <strong>{status.latest?.tag}</strong>, rebuild, run migrations, and reload
              the server. The site may serve old workers for a few seconds during reload.
            </p>
            <ul style={{ fontSize: "0.82rem", color: "#475569", margin: "0.5rem 0 1rem 1.2rem" }}>
              <li>Backup goes to <code>./backups/</code></li>
              <li>Rollback: <code>git reset --hard &lt;old-sha&gt;</code> + restore the dump</li>
              <li>The page auto-refreshes after PM2 reloads</li>
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="btn secondary small" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn small" onClick={startUpdate} disabled={starting}>
                {starting ? "Starting…" : "Yes, update now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#94a3b8",
  fontWeight: 600,
};

const bigStyle: React.CSSProperties = {
  fontSize: "1.4rem",
  fontWeight: 700,
  color: "#0f172a",
  marginTop: 2,
  fontVariantNumeric: "tabular-nums",
};
