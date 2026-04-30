"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApiKey } from "@/lib/types";
import { FormModal } from "@/components/admin-ui/FormModal";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import { useToast } from "@/components/admin-ui/Toast";
import {
  createApiKeyAction,
  deleteApiKeyAction,
  toggleApiKeyAction,
} from "./actions";

const PURPOSE_LABEL: Record<string, string> = {
  news_source: "News source",
  trends_source: "Trends source",
  text_ai: "Text AI",
  image_ai: "Image AI",
};

const PROVIDER_HINT: Record<string, string> = {
  newsnow: "NewsNow (news_source)",
  newsapi: "NewsAPI (news_source — legacy)",
  serpapi: "SerpAPI (trends_source)",
  gemini: "Google Gemini (text_ai)",
  openai: "OpenAI (text_ai)",
  anthropic: "Anthropic Claude (text_ai)",
  falai: "fal.ai (image_ai)",
};

function mask(value: string): string {
  if (!value) return "—";
  if (value.length <= 12) return "••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function ApiKeysClient({ keys }: { keys: ApiKey[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="admin-header">
        <div>
          <h2>API Keys</h2>
          <div className="subtitle">3rd-party credentials used by AI providers and the ingest pipeline.</div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add API Key
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Label</th>
              <th>Key (masked)</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 220, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.ApiKeyID}>
                <td>{k.ApiKeyID}</td>
                <td><strong>{k.Provider}</strong></td>
                <td>{PURPOSE_LABEL[k.Purpose] ?? k.Purpose}</td>
                <td>{k.Label ?? "—"}</td>
                <td style={{ fontSize: "0.72rem", fontFamily: "ui-monospace, monospace" }}>
                  {mask(k.KeyValue)}
                </td>
                <td>
                  {k.IsActive ? (
                    <span className="badge ok">active</span>
                  ) : (
                    <span className="badge off">inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <ToggleButton id={k.ApiKeyID} active={k.IsActive} />{" "}
                  <RowDeleteButton
                    action={deleteApiKeyAction}
                    id={k.ApiKeyID}
                    confirmTitle="Delete this API key?"
                    confirmDescription="The key will be removed from the database."
                    successMessage="API key deleted"
                  />
                </td>
              </tr>
            ))}
            {keys.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                  No API keys yet.
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
          title="Add API Key"
          size="md"
          submitLabel="Add key"
          successMessage="API key added"
          action={createApiKeyAction}
        >
          <NewKeyFields />
        </FormModal>
      ) : null}
    </>
  );
}

function NewKeyFields() {
  return (
    <>
      <div className="form-row">
        <label htmlFor="Provider">Provider *</label>
        <div>
          <input
            id="Provider"
            name="Provider"
            type="text"
            required
            placeholder="newsapi | gemini | falai | openai | anthropic"
            list="apikeys-providers"
          />
          <datalist id="apikeys-providers">
            {Object.keys(PROVIDER_HINT).map((p) => (
              <option key={p} value={p}>{PROVIDER_HINT[p]}</option>
            ))}
          </datalist>
          <small>Only one active key is allowed per (Provider, Purpose) pair.</small>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="Purpose">Purpose *</label>
        <select id="Purpose" name="Purpose" required defaultValue="">
          <option value="" disabled>Select…</option>
          {Object.entries(PURPOSE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l} ({v})
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="Label">Label</label>
        <input id="Label" type="text" name="Label" placeholder="Optional descriptive name" />
      </div>
      <div className="form-row">
        <label htmlFor="KeyValue">Key value *</label>
        <input
          id="KeyValue"
          type="password"
          name="KeyValue"
          required
          autoComplete="off"
          placeholder="Plain text — stored as-is"
        />
      </div>
      <div className="form-row">
        <label htmlFor="Config">Config (JSON)</label>
        <div>
          <textarea
            id="Config"
            name="Config"
            placeholder='{"model":"fal-ai/flux/schnell","imageSize":"landscape_16_9"}'
          />
          <small>Provider-specific settings (model, language, imageSize, etc.). Optional.</small>
        </div>
      </div>
      <div className="form-row">
        <label>Active</label>
        <div>
          <label style={{ fontWeight: 400, padding: 0 }}>
            <input type="checkbox" name="IsActive" /> Activate this key after creation
          </label>
          <small>Any other active key for the same (Provider, Purpose) pair will be deactivated.</small>
        </div>
      </div>
    </>
  );
}

function ToggleButton({ id, active }: { id: number; active: boolean }) {
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
            fd.append("id", String(id));
            fd.append("active", active ? "0" : "1");
            await toggleApiKeyAction(fd);
            toast.success(active ? "Key deactivated" : "Key activated");
            router.refresh();
          } catch (err) {
            toast.error(
              "Toggle failed",
              err instanceof Error ? err.message : "Unexpected error",
            );
          }
        });
      }}
    >
      {pending ? "…" : active ? "Deactivate" : "Activate"}
    </button>
  );
}
