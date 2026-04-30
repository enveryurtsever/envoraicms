"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormModal } from "@/components/admin-ui/FormModal";
import { LocalDate } from "@/components/admin-ui/LocalDate";
import { useToast } from "@/components/admin-ui/Toast";
import { savePromptAction, resetPromptAction } from "./actions";

type Prompt = {
  PromptKey: string;
  Label: string;
  Description: string | null;
  Template: string;
  UpdatedAt: string | null;
  hasDefault: boolean;
};

export function PromptsClient({ prompts }: { prompts: Prompt[] }) {
  const [editing, setEditing] = useState<Prompt | null>(null);

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>AI Prompts</h2>
          <div className="subtitle">
            Templates used by the ingest pipeline and the editor&apos;s suggestion buttons.
            <code style={{ marginLeft: 6 }}>{"{{CONTEXT}}"}</code> is replaced at runtime.
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Prompt</th>
              <th>Where it&apos;s used</th>
              <th style={{ width: 170 }}>Last updated</th>
              <th style={{ width: 230, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.PromptKey}>
                <td>
                  <div style={{ fontWeight: 500 }}>{p.Label}</div>
                  <code style={{ fontSize: "0.72rem", color: "#64748b" }}>{p.PromptKey}</code>
                </td>
                <td style={{ fontSize: "0.85rem", color: "#475569" }}>
                  {p.Description ?? <em style={{ color: "#94a3b8" }}>—</em>}
                </td>
                <td style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  <LocalDate value={p.UpdatedAt} mode="relative" />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setEditing(p)}
                  >
                    Edit
                  </button>{" "}
                  <ResetButton promptKey={p.PromptKey} hasDefault={p.hasDefault} />
                </td>
              </tr>
            ))}
            {prompts.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>
                  No prompts. Run the installer to seed the defaults.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <FormModal
          open
          onClose={() => setEditing(null)}
          title={`Edit prompt — ${editing.Label}`}
          size="xl"
          submitLabel="Save changes"
          successMessage="Prompt updated"
          action={savePromptAction}
        >
          <input type="hidden" name="key" defaultValue={editing.PromptKey} />
          <div className="form-row">
            <label htmlFor="label">Label</label>
            <input
              id="label"
              type="text"
              name="label"
              defaultValue={editing.Label}
              placeholder="Human-readable name"
            />
          </div>
          <div className="form-row">
            <label htmlFor="description">Description</label>
            <input
              id="description"
              type="text"
              name="description"
              defaultValue={editing.Description ?? ""}
              placeholder="Where is this prompt used?"
            />
          </div>
          <div className="form-row">
            <label htmlFor="template">Template</label>
            <div>
              <textarea
                id="template"
                name="template"
                defaultValue={editing.Template}
                rows={editing.PromptKey === "ingest_system" ? 24 : 14}
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "0.8rem",
                }}
              />
              <small>
                {editing.PromptKey.startsWith("suggest_") ? (
                  <>
                    For the editor&apos;s suggest buttons. <code>{"{{CONTEXT}}"}</code> is
                    replaced with the relevant fields. Gemini must return{" "}
                    <code>{'{"suggestion":"..."}'}</code>.
                  </>
                ) : editing.PromptKey === "ingest_system" ? (
                  <>
                    Ingest pipeline system prompt. Don&apos;t change the JSON schema — the
                    code parser expects those exact fields.
                  </>
                ) : null}
              </small>
            </div>
          </div>
        </FormModal>
      ) : null}
    </>
  );
}

function ResetButton({
  promptKey,
  hasDefault,
}: {
  promptKey: string;
  hasDefault: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  if (!hasDefault) {
    return (
      <span className="badge off" title="No built-in default for this prompt">
        custom
      </span>
    );
  }
  return (
    <button
      type="button"
      className="btn secondary small"
      title="Restore the built-in default"
      disabled={pending}
      onClick={() => {
        if (!confirm("Reset this prompt to the built-in default?")) return;
        startTransition(async () => {
          try {
            const fd = new FormData();
            fd.append("key", promptKey);
            await resetPromptAction(fd);
            toast.success("Prompt reset to default");
            router.refresh();
          } catch (err) {
            toast.error(
              "Reset failed",
              err instanceof Error ? err.message : "Unexpected error",
            );
          }
        });
      }}
    >
      {pending ? "…" : "Reset"}
    </button>
  );
}
