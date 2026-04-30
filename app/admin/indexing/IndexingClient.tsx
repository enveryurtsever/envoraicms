"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/types";
import { Tabs } from "@/components/admin-ui/Tabs";
import { useToast } from "@/components/admin-ui/Toast";
import { LocalDate } from "@/components/admin-ui/LocalDate";
import { saveIndexingAction, submitManualAction } from "./actions";

type LogRow = {
  LogID: number;
  Url: string;
  Type: string;
  Status: string;
  HttpStatus: number | null;
  Message: string | null;
  SubmittedAt: string;
};

export function IndexingClient({
  settings,
  saEmail,
  logs,
  counts,
}: {
  settings: Settings;
  saEmail: string | null;
  logs: LogRow[];
  counts: { ok: number; error: number };
}) {
  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Search Console</h2>
          <div className="subtitle">
            Notify Google about new and updated URLs via the Indexing API.
          </div>
        </div>
      </div>

      <Tabs
        storageKey="adm:indexing:tab"
        tabs={[
          {
            id: "configuration",
            label: "Configuration",
            hint: "Service account & toggle",
            content: <ConfigurationTab settings={settings} saEmail={saEmail} />,
          },
          {
            id: "manual",
            label: "Manual submit",
            hint: "Submit a single URL",
            content: <ManualTab />,
          },
          {
            id: "logs",
            label: "Logs",
            hint: `${counts.ok} ok · ${counts.error} errors / 24h`,
            content: <LogsTab logs={logs} counts={counts} />,
          },
        ]}
      />
    </>
  );
}

function ConfigurationTab({
  settings,
  saEmail,
}: {
  settings: Settings;
  saEmail: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(fd: FormData) {
    startTransition(async () => {
      try {
        await saveIndexingAction(fd);
        toast.success("Indexing settings saved");
        router.refresh();
      } catch (err) {
        toast.error("Save failed", err instanceof Error ? err.message : "Unexpected error");
      }
    });
  }

  return (
    <form action={handleSubmit} autoComplete="off">
      <div className="card">
        <h3>Service account &amp; auto-submit</h3>
        <div className="form-row">
          <label htmlFor="IndexingEnabled">Automatic indexing</label>
          <div>
            <label style={{ fontWeight: 400, padding: 0, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="IndexingEnabled"
                type="checkbox"
                name="IndexingEnabled"
                defaultChecked={settings.IndexingEnabled}
                className="switch"
              />
              Send automatic URL notifications for new / updated content
            </label>
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="IndexingServiceAccountJSON">Service account JSON</label>
          <div>
            <textarea
              id="IndexingServiceAccountJSON"
              name="IndexingServiceAccountJSON"
              defaultValue={settings.IndexingServiceAccountJSON ?? ""}
              rows={12}
              style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}
              placeholder='{ "type": "service_account", "client_email": "...", "private_key": "-----BEGIN PRIVATE KEY-----..." }'
            />
            <small>
              Google Cloud Indexing API service account JSON. You must add this account to
              Search Console as an <strong>owner</strong>. Stored unencrypted; only the{" "}
              <em>admin</em> role can view or edit it.
              {saEmail ? (
                <> Currently saved as <code>{saEmail}</code>.</>
              ) : null}
            </small>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ManualTab() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(fd: FormData) {
    startTransition(async () => {
      try {
        await submitManualAction(fd);
        toast.success("URL sent to Google");
        router.refresh();
      } catch (err) {
        toast.error(
          "Submission failed",
          err instanceof Error ? err.message : "Unexpected error",
        );
      }
    });
  }

  return (
    <form action={handleSubmit} autoComplete="off">
      <div className="card">
        <h3>Manual submit</h3>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 0 }}>
          Send a single URL to the Indexing API. The full URL is built from{" "}
          <code>SiteUrl</code> + <code>/s/&lt;slug&gt;</code>.
        </p>
        <div className="form-row">
          <label htmlFor="contentId">Content ID</label>
          <input id="contentId" type="number" name="contentId" placeholder="e.g. 123" required />
        </div>
        <div className="form-row">
          <label htmlFor="slug">Slug</label>
          <input id="slug" type="text" name="slug" placeholder="e.g. breaking-news-title" required />
        </div>
        <div className="form-row">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue="URL_UPDATED">
            <option value="URL_UPDATED">URL_UPDATED (new / updated)</option>
            <option value="URL_DELETED">URL_DELETED (removed)</option>
          </select>
        </div>
        <div style={{ textAlign: "right" }}>
          <button type="submit" className="btn secondary" disabled={pending}>
            {pending ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </form>
  );
}

function LogsTab({
  logs,
  counts,
}: {
  logs: LogRow[];
  counts: { ok: number; error: number };
}) {
  return (
    <>
      <div className="card">
        <h3>Last 24 hours</h3>
        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.9rem" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Successful
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#16a34a" }}>{counts.ok}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Errored
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#b91c1c" }}>{counts.error}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Quota
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#475569" }}>200/day</div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>free tier</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1.1rem 1.25rem 0.5rem" }}>
          <h3 style={{ margin: 0 }}>Last 50 entries</h3>
        </div>
        {logs.length === 0 ? (
          <p style={{ color: "#64748b", padding: "0 1.25rem 1.25rem" }}>No entries yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Date</th>
                <th>URL</th>
                <th style={{ width: 100 }}>Type</th>
                <th style={{ width: 80 }}>Status</th>
                <th style={{ width: 70 }}>HTTP</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.LogID}>
                  <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                    <LocalDate value={l.SubmittedAt} mode="datetime" />
                  </td>
                  <td style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>{l.Url}</td>
                  <td style={{ fontSize: "0.78rem" }}>{l.Type}</td>
                  <td>
                    {l.Status === "ok" ? (
                      <span className="badge ok">ok</span>
                    ) : (
                      <span className="badge err">error</span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.78rem" }}>{l.HttpStatus ?? "—"}</td>
                  <td style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {l.Message ? l.Message.slice(0, 120) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
