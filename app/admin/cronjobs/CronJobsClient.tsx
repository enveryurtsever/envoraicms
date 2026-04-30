"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, CronJob } from "@/lib/types";
import { FormModal } from "@/components/admin-ui/FormModal";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import { LocalDate } from "@/components/admin-ui/LocalDate";
import { useToast } from "@/components/admin-ui/Toast";
import { CronJobFields } from "./CronJobFields";
import {
  createCronJobAction,
  updateCronJobAction,
  deleteCronJobAction,
  triggerCronJobAction,
  refillArticleJobAction,
} from "./actions";

type Preflight = {
  ok: boolean;
  missing: string[];
};

export function CronJobsClient({
  jobs,
  categories,
  preflight,
}: {
  jobs: CronJob[];
  categories: Category[];
  preflight: Preflight;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CronJob | null>(null);
  const catById = new Map(categories.map((c) => [c.CatID, c]));

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Automation</h2>
          <div className="subtitle">
            Scheduled ingest tasks (news pipeline + article pipeline). The systemd
            timer ticks every 10 minutes.
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add Automation
          </button>
        </div>
      </div>

      {!preflight.ok ? (
        <div
          className="card"
          role="alert"
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#7f1d1d",
            padding: "0.85rem 1rem",
            marginBottom: "1rem",
          }}
        >
          <strong>Automation paused.</strong>{" "}
          Trigger and Refill are disabled until configuration is complete.
          {preflight.missing.length > 0 ? (
            <ul style={{ margin: "0.4rem 0 0 1rem", padding: 0, fontSize: "0.85rem" }}>
              {preflight.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>ID</th>
              <th>Job</th>
              <th>Category</th>
              <th>Cron</th>
              <th>Providers</th>
              <th>Last run</th>
              <th>Next run</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 280, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const cat = j.FK_CatID ? catById.get(j.FK_CatID) : null;
              const statusBadge =
                j.LastRunStatus === "ok"
                  ? "ok"
                  : j.LastRunStatus === "error"
                    ? "err"
                    : "off";
              return (
                <tr key={j.CronID}>
                  <td>{j.CronID}</td>
                  <td>
                    <strong>{j.JobName}</strong>
                    <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                      <span className="badge off" style={{ marginRight: 4 }}>
                        {j.Kind === "article" ? "article" : "news"}
                      </span>
                      {j.ArticlesPerRun} per tick
                    </div>
                  </td>
                  <td>{cat ? cat.CatName : <em style={{ color: "#9ca3af" }}>global</em>}</td>
                  <td>
                    <code style={{ fontSize: "0.75rem" }}>{j.FrequencyCron}</code>
                  </td>
                  <td style={{ fontSize: "0.75rem" }}>
                    {j.Kind === "article" ? (
                      <>
                        <div>seed: {(j.Config?.seedQuery as string | undefined) ?? "—"}</div>
                        <div>image: {j.ImageAiProvider ?? "passthrough"}</div>
                      </>
                    ) : (
                      <>
                        <div>news: {j.NewsProvider ?? "—"}</div>
                        <div>text: {j.TextAiProvider ?? "—"}</div>
                        <div>image: {j.ImageAiProvider ?? "passthrough"}</div>
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: "0.75rem" }}>
                    <div><LocalDate value={j.LastRunAt} mode="relative" /></div>
                    {j.LastRunStatus ? (
                      <span className={`badge ${statusBadge}`}>{j.LastRunStatus}</span>
                    ) : null}
                    {j.LastRunMessage ? (
                      <div style={{ color: "#6b7280", marginTop: 2 }}>
                        {j.LastRunMessage.slice(0, 80)}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ fontSize: "0.75rem" }}>
                    <LocalDate value={j.NextRunAt} mode="relative" />
                  </td>
                  <td>
                    {j.IsActive ? (
                      <span className="badge ok">active</span>
                    ) : (
                      <span className="badge off">inactive</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {j.Kind === "article" ? (
                      <>
                        <RefillButton
                          id={j.CronID}
                          name={j.JobName}
                          disabled={!preflight.ok}
                          disabledReason={preflight.missing.join(" ")}
                        />{" "}
                      </>
                    ) : null}
                    <TriggerButton
                      id={j.CronID}
                      name={j.JobName}
                      disabled={!preflight.ok}
                      disabledReason={preflight.missing.join(" ")}
                    />{" "}
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => setEditing(j)}
                    >
                      Edit
                    </button>{" "}
                    <RowDeleteButton
                      action={deleteCronJobAction}
                      id={j.CronID}
                      confirmTitle={`Delete "${j.JobName}"?`}
                      confirmDescription="The job will be soft-deleted and stop running."
                      successMessage="Cron job deleted"
                    />
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "2rem" }}>
                  No cron jobs yet. Add a new one to start ingesting articles.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {creating ? (
        <FormModal
          open
          onClose={() => setCreating(false)}
          title="Add Automation"
          size="lg"
          submitLabel="Create job"
          successMessage="Cron job created"
          action={createCronJobAction}
        >
          <CronJobFields categories={categories} />
        </FormModal>
      ) : null}

      {editing ? (
        <FormModal
          open
          onClose={() => setEditing(null)}
          title={`Edit "${editing.JobName}"`}
          size="lg"
          submitLabel="Save changes"
          successMessage="Cron job updated"
          action={updateCronJobAction}
        >
          <CronJobFields categories={categories} initial={editing} />
        </FormModal>
      ) : null}
    </>
  );
}

function TriggerButton({
  id,
  name,
  disabled = false,
  disabledReason,
}: {
  id: number;
  name: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn secondary small"
      title={
        disabled
          ? disabledReason ?? "Configuration required before running automation"
          : "Run this job now"
      }
      disabled={pending || disabled}
      onClick={() => {
        startTransition(async () => {
          toast.info(`Running "${name}"…`);
          try {
            const fd = new FormData();
            fd.append("id", String(id));
            await triggerCronJobAction(fd);
            toast.success("Job finished", `"${name}" run completed.`);
            router.refresh();
          } catch (err) {
            toast.error(
              "Job failed",
              err instanceof Error ? err.message : "Unexpected error",
            );
          }
        });
      }}
    >
      {pending ? "Running…" : "▶ Trigger"}
    </button>
  );
}

function RefillButton({
  id,
  name,
  disabled = false,
  disabledReason,
}: {
  id: number;
  name: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn secondary small"
      title={
        disabled
          ? disabledReason ?? "Configuration required before running automation"
          : "Force a fresh ideation batch (SerpAPI + Meta AI)"
      }
      disabled={pending || disabled}
      onClick={() => {
        startTransition(async () => {
          toast.info(`Refilling drafts for "${name}"…`);
          try {
            const fd = new FormData();
            fd.append("id", String(id));
            await refillArticleJobAction(fd);
            toast.success("Drafts refilled", `New ideas saved for "${name}".`);
            router.refresh();
          } catch (err) {
            toast.error(
              "Refill failed",
              err instanceof Error ? err.message : "Unexpected error",
            );
          }
        });
      }}
    >
      {pending ? "Refilling…" : "🔁 Refill"}
    </button>
  );
}
