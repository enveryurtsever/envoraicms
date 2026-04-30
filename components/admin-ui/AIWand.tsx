"use client";

import { useRef, useState } from "react";
import { Tooltip } from "./Tooltip";
import { IconWand } from "./Icon";
import { useToast } from "./Toast";

export type SuggestField =
  | "title"
  | "short"
  | "desc"
  | "keywords"
  | "detail"
  | "imagePrompt";

type CtxKey = "title" | "short" | "desc" | "keywords" | "detail" | "category" | "imagePrompt";

// Input/textarea with a built-in 🪄 wand button. The button calls
// /api/admin/ai/suggest with `fieldKey` and gathers context from sibling
// named form fields via `contextMap`. The resulting suggestion appears in a
// preview panel; the user clicks Apply to write it into the input.
export function AIInputRow({
  label,
  name,
  defaultValue,
  textarea,
  hint,
  placeholder,
  fieldKey,
  contextMap,
  rows,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  textarea?: boolean;
  hint?: string;
  placeholder?: string;
  fieldKey: SuggestField;
  contextMap?: Partial<Record<CtxKey, string>>;
  rows?: number;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const toast = useToast();

  function gatherContext(): Record<string, string> {
    const form = ref.current?.closest("form") ?? null;
    const ctx: Record<string, string> = {};
    if (form && contextMap) {
      for (const [ctxKey, fieldName] of Object.entries(contextMap)) {
        if (!fieldName) continue;
        const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          `[name="${fieldName}"]`,
        );
        if (el && typeof el.value === "string" && el.value.trim()) {
          ctx[ctxKey] = el.value.trim();
        }
      }
    }
    const self = ref.current?.value ?? "";
    if (self.trim()) {
      const selfKey: CtxKey =
        fieldKey === "imagePrompt"
          ? "imagePrompt"
          : (fieldKey as CtxKey);
      if (!ctx[selfKey]) ctx[selfKey] = self.trim();
    }
    return ctx;
  }

  async function run() {
    setPending(true);
    setSuggestion(null);
    try {
      const res = await fetch("/api/admin/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: fieldKey, context: gatherContext() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { suggestion?: string; error?: string; message?: string; retryAfterSec?: number }
        | null;
      if (!res.ok || !data?.suggestion) {
        if (data?.error === "no_api_key") {
          throw new Error("No active Gemini (text_ai) API key. Add one in /admin/apikeys.");
        }
        if (data?.error === "rate_limited") {
          throw new Error(`Too fast. Try again in ${data.retryAfterSec ?? 60}s.`);
        }
        throw new Error(data?.message ?? `AI call failed (${res.status}).`);
      }
      setSuggestion(data.suggestion);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      toast.error("AI suggest failed", msg);
    } finally {
      setPending(false);
    }
  }

  function apply() {
    if (suggestion == null || !ref.current) return;
    ref.current.value = suggestion;
    setSuggestion(null);
    toast.success("Suggestion applied");
  }

  return (
    <div className="form-row">
      <label htmlFor={name} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span>{label}</span>
        <Tooltip label={pending ? "Generating…" : "Suggest with AI"}>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className={`btn-icon ${pending ? "spinning" : ""}`}
            aria-label="Suggest with AI"
          >
            <IconWand size={14} />
          </button>
        </Tooltip>
      </label>
      <div>
        {textarea ? (
          <textarea
            id={name}
            name={name}
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
            rows={rows}
            ref={ref as React.Ref<HTMLTextAreaElement>}
          />
        ) : (
          <input
            id={name}
            name={name}
            type="text"
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
            ref={ref as React.Ref<HTMLInputElement>}
          />
        )}
        {hint ? <small>{hint}</small> : null}
        {suggestion != null ? (
          <div
            className="card"
            style={{ marginTop: "0.5rem", padding: "0.75rem", background: "#f8fafc" }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 4 }}>
              AI suggestion
            </div>
            <div
              style={{
                fontSize: textarea ? "0.85rem" : "0.92rem",
                whiteSpace: "pre-wrap",
                maxHeight: textarea ? 200 : "auto",
                overflow: "auto",
              }}
            >
              {suggestion}
            </div>
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem" }}>
              <button type="button" className="btn small" onClick={apply}>
                Apply
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={run}
                disabled={pending}
              >
                Try again
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setSuggestion(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
