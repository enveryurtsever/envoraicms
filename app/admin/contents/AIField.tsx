"use client";

import { useRef, useState } from "react";
import type { SuggestField } from "@/lib/ingest/ai/suggest";
import { Tooltip } from "@/components/admin-ui/Tooltip";
import { IconWand } from "@/components/admin-ui/Icon";
import { RichTextEditor } from "@/components/admin-ui/RichTextEditor";

type Props = {
  fieldKey: SuggestField;
  name: string;
  label: string;
  initialValue?: string | null;
  contextFields?: string[];
  textarea?: boolean;
  /** Render a rich text editor instead of a plain textarea. Mutually
   *  exclusive with `textarea`/`big`. The hidden input's value is the
   *  editor's HTML. */
  rich?: boolean;
  big?: boolean;
  hint?: string;
};

async function callSuggest(
  field: SuggestField,
  context: Record<string, string>,
): Promise<string> {
  const res = await fetch("/api/admin/ai/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field, context }),
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
  return data.suggestion;
}

function collectContext(fieldKeys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of fieldKeys) {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[name="${name}"]`,
    );
    if (!el) continue;
    const key = aliasFor(name);
    if (key) out[key] = el.value;
  }
  // Pull in any contenteditable rich-editor values that match by hidden
  // input name (e.g. ContentDetail rendered as RichTextEditor).
  for (const name of fieldKeys) {
    if (out[aliasFor(name) ?? ""] !== undefined) continue;
    const hidden = document.querySelector<HTMLInputElement>(
      `input[type="hidden"][name="${name}"]`,
    );
    const key = aliasFor(name);
    if (hidden && key) out[key] = hidden.value;
  }
  const catSel = document.querySelector<HTMLSelectElement>('[name="FK_CatID"]');
  if (catSel?.selectedOptions?.[0]?.textContent) {
    out.category = catSel.selectedOptions[0].textContent.trim();
  }
  return out;
}

function aliasFor(name: string): string | null {
  switch (name) {
    case "ContentTitle": return "title";
    case "ContentShort": return "short";
    case "ContentDesc": return "desc";
    case "ContentKeywords": return "keywords";
    case "ContentDetail": return "detail";
    case "ImagePrompt": return "imagePrompt";
    default: return null;
  }
}

export function AIField({
  fieldKey,
  name,
  label,
  initialValue,
  contextFields = [],
  textarea,
  rich,
  big,
  hint,
}: Props) {
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [richValue, setRichValue] = useState<string>(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const onSuggest = async () => {
    setError(null);
    setPending(true);
    setSuggestion(null);
    try {
      const self = rich ? richValue : (inputRef.current?.value ?? "");
      const ctx = collectContext(contextFields);
      const alias = aliasFor(name);
      if (alias) ctx[alias] = self;
      const s = await callSuggest(fieldKey, ctx);
      setSuggestion(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setPending(false);
    }
  };

  const apply = () => {
    if (suggestion == null) return;
    if (rich) {
      setRichValue(suggestion);
    } else if (inputRef.current) {
      inputRef.current.value = suggestion;
    }
    setSuggestion(null);
  };

  return (
    <div className="form-row">
      <label htmlFor={name} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span>{label}</span>
        <Tooltip label={pending ? "Generating…" : "Suggest with AI"}>
          <button
            type="button"
            onClick={onSuggest}
            disabled={pending}
            className={`btn-icon ${pending ? "spinning" : ""}`}
            aria-label="Suggest with AI"
          >
            <IconWand size={15} />
          </button>
        </Tooltip>
      </label>
      <div>
        {rich ? (
          <RichTextEditor
            name={name}
            value={richValue}
            onChange={setRichValue}
            rows={big ? 18 : 12}
          />
        ) : textarea ? (
          <textarea
            id={name}
            name={name}
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            defaultValue={initialValue ?? ""}
            style={big ? { minHeight: 320, fontFamily: "ui-monospace, SF Mono, monospace" } : undefined}
          />
        ) : (
          <input
            id={name}
            name={name}
            type="text"
            ref={inputRef as React.Ref<HTMLInputElement>}
            defaultValue={initialValue ?? ""}
          />
        )}
        {hint ? <small>{hint}</small> : null}
        {error ? (
          <div className="alert error" style={{ marginTop: "0.5rem" }}>
            {error}
          </div>
        ) : null}
        {suggestion != null ? (
          <div
            className="card"
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem",
              background: "#f8fafc",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 4 }}>
              AI suggestion
            </div>
            {textarea ? (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "0.78rem",
                  margin: 0,
                  maxHeight: 240,
                  overflow: "auto",
                }}
              >
                {suggestion}
              </pre>
            ) : (
              <div style={{ fontSize: "0.92rem" }}>{suggestion}</div>
            )}
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem" }}>
              <button type="button" className="btn small" onClick={apply}>
                Apply
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={onSuggest}
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
