"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocalDate } from "@/components/admin-ui/LocalDate";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import { useToast } from "@/components/admin-ui/Toast";
import { Modal } from "@/components/admin-ui/Modal";
import type { Draft, DraftStatus } from "@/lib/ingest/drafts";
import {
  processPendingAction,
  retryDraftAction,
  deleteDraftAction,
} from "./actions";

const STATUS_BADGE: Record<DraftStatus, string> = {
  pending: "off",
  processing: "off",
  done: "ok",
  skipped: "off",
  error: "err",
};

export function DraftsClient({
  drafts,
  counts,
}: {
  drafts: Draft[];
  counts: Record<DraftStatus, number>;
}) {
  const [filter, setFilter] = useState<DraftStatus | "all">("all");
  const [pending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<Draft | null>(null);
  const router = useRouter();
  const toast = useToast();

  function handleProcess(limit: number) {
    startTransition(async () => {
      try {
        toast.info("Processing pending drafts…");
        const fd = new FormData();
        fd.append("limit", String(limit));
        await processPendingAction(fd);
        toast.success("Drafts processed");
        router.refresh();
      } catch (err) {
        toast.error(
          "Process failed",
          err instanceof Error ? err.message : "Unexpected error",
        );
      }
    });
  }

  const filtered = filter === "all" ? drafts : drafts.filter((d) => d.Status === filter);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
          Articles fetched from external news APIs, waiting for Gemini to rewrite
          and file them under the right site category.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => handleProcess(5)}
          disabled={pending || counts.pending === 0}
        >
          {pending ? "Processing…" : `▶ Process ${Math.min(5, counts.pending)} pending`}
        </button>
      </div>

      <div className="stat-grid">
        <StatTile label="Pending" value={counts.pending} color="#f59e0b" />
        <StatTile label="Done" value={counts.done} color="#16a34a" />
        <StatTile label="Skipped" value={counts.skipped} color="#94a3b8" />
        <StatTile label="Errored" value={counts.error} color="#dc2626" />
        <StatTile label="Processing" value={counts.processing} color="#0ea5e9" />
      </div>

      <div className="card" style={{ padding: "0.85rem 1.1rem", marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Filter:</span>
        <FilterChip current={filter} value="all" onClick={setFilter}>All</FilterChip>
        <FilterChip current={filter} value="pending" onClick={setFilter}>Pending</FilterChip>
        <FilterChip current={filter} value="done" onClick={setFilter}>Done</FilterChip>
        <FilterChip current={filter} value="skipped" onClick={setFilter}>Skipped</FilterChip>
        <FilterChip current={filter} value="error" onClick={setFilter}>Errored</FilterChip>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: "1rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th>Title</th>
              <th style={{ width: 130 }}>Source</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 130 }}>Fetched</th>
              <th style={{ width: 260, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.DraftID}>
                <td>{d.DraftID}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>
                    {(d.RawJSON.title as string | undefined) ?? "(no title)"}
                  </div>
                  {d.Message ? (
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>
                      {d.Message.slice(0, 140)}
                    </div>
                  ) : null}
                </td>
                <td style={{ fontSize: "0.78rem" }}>
                  {d.SourceTitle ? (
                    <div>{d.SourceTitle}</div>
                  ) : null}
                  {d.SourceUrl ? (
                    <a href={d.SourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                      original ↗
                    </a>
                  ) : null}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[d.Status]}`}>{d.Status}</span>
                </td>
                <td style={{ fontSize: "0.75rem" }}>
                  <LocalDate value={d.FetchedAt} mode="relative" />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setViewing(d)}
                  >
                    View raw
                  </button>{" "}
                  {d.Status === "error" || d.Status === "skipped" ? (
                    <RetryButton id={d.DraftID} />
                  ) : null}{" "}
                  <RowDeleteButton
                    action={deleteDraftAction}
                    id={d.DraftID}
                    confirmTitle="Delete this draft?"
                    confirmDescription="The raw payload will be removed. The Contents row (if any) is kept."
                    successMessage="Draft deleted"
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                  No drafts {filter === "all" ? "yet" : `in "${filter}"`}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Raw payload" size="xl">
        {viewing ? (
          <pre
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.78rem",
              background: "#0f172a",
              color: "#e2e8f0",
              padding: "1rem",
              borderRadius: 8,
              maxHeight: "60vh",
              overflow: "auto",
            }}
          >
            {JSON.stringify(viewing.RawJSON, null, 2)}
          </pre>
        ) : null}
      </Modal>
    </>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="stat stat--accent"
      style={{ "--accent-from": color, "--accent-to": color } as React.CSSProperties}
    >
      <div className="label">{label}</div>
      <div className="value">{value.toLocaleString(undefined)}</div>
    </div>
  );
}

function FilterChip({
  current,
  value,
  onClick,
  children,
}: {
  current: DraftStatus | "all";
  value: DraftStatus | "all";
  onClick: (v: DraftStatus | "all") => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        padding: "0.32rem 0.85rem",
        borderRadius: 999,
        border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
        background: active ? "#eff6ff" : "#fff",
        color: active ? "#1d4ed8" : "#475569",
        fontSize: "0.78rem",
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function RetryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn secondary small"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const fd = new FormData();
            fd.append("id", id);
            await retryDraftAction(fd);
            toast.success("Draft queued for retry");
            router.refresh();
          } catch (err) {
            toast.error(
              "Retry failed",
              err instanceof Error ? err.message : "Unexpected error",
            );
          }
        });
      }}
    >
      {pending ? "…" : "Retry"}
    </button>
  );
}
