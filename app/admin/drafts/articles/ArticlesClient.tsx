"use client";

import { useState } from "react";
import type {
  ArticleDraft,
  ArticleDraftStatus,
  Category,
} from "@/lib/types";
import { LocalDate } from "@/components/admin-ui/LocalDate";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import {
  retryArticleDraftAction,
  deleteArticleDraftAction,
} from "../actions";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin-ui/Toast";

const STATUS_BADGE: Record<ArticleDraftStatus, string> = {
  pending: "off",
  processing: "off",
  done: "ok",
  skipped: "off",
  error: "err",
};

export function ArticlesClient({
  drafts,
  counts,
  categories,
}: {
  drafts: ArticleDraft[];
  counts: Record<ArticleDraftStatus, number>;
  categories: Category[];
}) {
  const [filter, setFilter] = useState<ArticleDraftStatus | "all">("all");
  const catById = new Map(categories.map((c) => [c.CatID, c]));

  const filtered =
    filter === "all" ? drafts : drafts.filter((d) => d.Status === filter);

  return (
    <>
      <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 1rem" }}>
        Article topics ideated by the meta AI from SerpAPI trends. Each draft
        will be expanded into a full article on the next cron tick of the
        owning Automation job. Use Automation → 🔁 Refill to top up the
        backlog.
      </p>

      <div className="stat-grid">
        <StatTile label="Pending" value={counts.pending} color="#f59e0b" />
        <StatTile label="Done" value={counts.done} color="#16a34a" />
        <StatTile label="Errored" value={counts.error} color="#dc2626" />
        <StatTile label="Processing" value={counts.processing} color="#0ea5e9" />
        <StatTile label="Skipped" value={counts.skipped} color="#94a3b8" />
      </div>

      <div
        className="card"
        style={{
          padding: "0.85rem 1.1rem",
          marginTop: "1rem",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Filter:</span>
        <FilterChip current={filter} value="all" onClick={setFilter}>All</FilterChip>
        <FilterChip current={filter} value="pending" onClick={setFilter}>Pending</FilterChip>
        <FilterChip current={filter} value="done" onClick={setFilter}>Done</FilterChip>
        <FilterChip current={filter} value="error" onClick={setFilter}>Errored</FilterChip>
        <FilterChip current={filter} value="skipped" onClick={setFilter}>Skipped</FilterChip>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: "1rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th>Title / summary</th>
              <th style={{ width: 130 }}>Category</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 130 }}>Created</th>
              <th style={{ width: 200, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.DraftID}>
                <td>{d.DraftID}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{d.Title}</div>
                  {d.Summary ? (
                    <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                      {d.Summary.slice(0, 160)}
                    </div>
                  ) : null}
                  {d.TrendQuery ? (
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 2 }}>
                      trend: <code>{d.TrendQuery}</code>
                    </div>
                  ) : null}
                  {d.Message ? (
                    <div style={{ fontSize: "0.72rem", color: "#dc2626", marginTop: 2 }}>
                      {d.Message.slice(0, 140)}
                    </div>
                  ) : null}
                </td>
                <td style={{ fontSize: "0.78rem" }}>
                  {catById.get(d.FK_CatID)?.CatName ?? `#${d.FK_CatID}`}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[d.Status]}`}>
                    {d.Status}
                  </span>
                </td>
                <td style={{ fontSize: "0.75rem" }}>
                  <LocalDate value={d.CreatedAt} mode="relative" />
                </td>
                <td style={{ textAlign: "right" }}>
                  {d.Status === "error" || d.Status === "skipped" ? (
                    <RetryButton id={d.DraftID} />
                  ) : null}{" "}
                  <RowDeleteButton
                    action={deleteArticleDraftAction}
                    id={d.DraftID}
                    confirmTitle="Delete this draft?"
                    confirmDescription="The idea row will be removed. Any Contents row already created stays."
                    successMessage="Article draft deleted"
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                  No article drafts {filter === "all" ? "yet" : `in "${filter}"`}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
  current: ArticleDraftStatus | "all";
  value: ArticleDraftStatus | "all";
  onClick: (v: ArticleDraftStatus | "all") => void;
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
            await retryArticleDraftAction(fd);
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
