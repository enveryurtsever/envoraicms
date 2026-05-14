"use client";

import { useEffect, useRef, useState } from "react";
import { IconCode } from "./Icon";

type Props = {
  /** Form field name. The editor mirrors its current HTML into a hidden input
   *  with this name so it submits as part of the surrounding form. */
  name: string;
  defaultValue?: string;
  /** Optional controlled value. When provided, callers can push HTML into
   *  the editor (e.g. applying an AI suggestion). */
  value?: string;
  onChange?: (html: string) => void;
  rows?: number;
  placeholder?: string;
};

type Cmd =
  | { kind: "exec"; cmd: string; arg?: string; label: string; title: string }
  | { kind: "block"; tag: "h2" | "h3" | "p" | "blockquote"; label: string; title: string }
  | { kind: "link"; label: string; title: string }
  | { kind: "clear"; label: string; title: string };

const TOOLBAR: Cmd[] = [
  { kind: "exec", cmd: "bold",       label: "B",   title: "Bold (Ctrl+B)" },
  { kind: "exec", cmd: "italic",     label: "I",   title: "Italic (Ctrl+I)" },
  { kind: "exec", cmd: "underline",  label: "U",   title: "Underline" },
  { kind: "block", tag: "h2",        label: "H2",  title: "Heading" },
  { kind: "block", tag: "h3",        label: "H3",  title: "Subheading" },
  { kind: "block", tag: "p",         label: "P",   title: "Paragraph" },
  { kind: "block", tag: "blockquote", label: "❝",  title: "Quote" },
  { kind: "exec", cmd: "insertUnorderedList", label: "• List", title: "Bullet list" },
  { kind: "exec", cmd: "insertOrderedList",   label: "1. List", title: "Numbered list" },
  { kind: "link",                     label: "🔗",  title: "Insert link" },
  { kind: "clear",                    label: "✕",   title: "Clear formatting" },
];

/** Lightweight contenteditable editor. Emits HTML into a hidden `<input>` so
 *  the existing FormData/server-action flow works unchanged. The "Source"
 *  button swaps the rich surface for a raw-HTML textarea, useful for fixing
 *  AI output, pasting markup, or inspecting what got saved. */
export function RichTextEditor({
  name,
  defaultValue = "",
  value: controlled,
  onChange,
  rows = 12,
  placeholder,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [internal, setInternal] = useState(defaultValue);
  const [sourceMode, setSourceMode] = useState(false);
  const value = controlled ?? internal;

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== defaultValue) {
      editorRef.current.innerHTML = defaultValue;
    }
    // We intentionally do not re-run on local edits, that would fight the
    // user's caret position on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a controlled value is pushed in (e.g. AI suggestion applied), mirror
  // it into the contenteditable surface.
  useEffect(() => {
    if (controlled === undefined) return;
    if (editorRef.current && editorRef.current.innerHTML !== controlled) {
      editorRef.current.innerHTML = controlled;
    }
  }, [controlled]);

  // Returning from source mode: push the (possibly hand-edited) HTML back
  // into the contenteditable surface.
  useEffect(() => {
    if (sourceMode) return;
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [sourceMode, value]);

  function sync() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    if (controlled === undefined) setInternal(html);
    onChange?.(html);
  }

  function setHtml(html: string) {
    if (controlled === undefined) setInternal(html);
    onChange?.(html);
  }

  function exec(cmd: string, arg?: string) {
    if (sourceMode) return;
    document.execCommand(cmd, false, arg);
    editorRef.current?.focus();
    sync();
  }

  function applyBlock(tag: string) {
    if (sourceMode) return;
    document.execCommand("formatBlock", false, tag);
    editorRef.current?.focus();
    sync();
  }

  function insertLink() {
    if (sourceMode) return;
    const url = prompt("URL");
    if (!url) return;
    exec("createLink", url);
  }

  function clearFormatting() {
    if (sourceMode) return;
    exec("removeFormat");
  }

  return (
    <div className="rt-editor">
      <div className="rt-toolbar" role="toolbar" aria-label="Formatting">
        {TOOLBAR.map((t, i) => {
          const onClick =
            t.kind === "exec"
              ? () => exec(t.cmd, t.arg)
              : t.kind === "block"
                ? () => applyBlock(t.tag)
                : t.kind === "link"
                  ? insertLink
                  : clearFormatting;
          return (
            <button
              key={i}
              type="button"
              title={t.title}
              onClick={onClick}
              className="rt-btn"
              disabled={sourceMode}
            >
              {t.label}
            </button>
          );
        })}
        <button
          type="button"
          title={sourceMode ? "Back to rich view" : "View HTML source"}
          aria-pressed={sourceMode}
          onClick={() => setSourceMode((m) => !m)}
          className="rt-btn"
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            background: sourceMode ? "#eef2ff" : undefined,
            color: sourceMode ? "#1d4ed8" : undefined,
          }}
        >
          <IconCode size={14} />
          <span>{sourceMode ? "Rich" : "Source"}</span>
        </button>
      </div>
      <div
        ref={editorRef}
        className="rt-canvas"
        contentEditable={!sourceMode}
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder ?? "Start typing..."}
        style={{
          minHeight: `${rows * 1.4}rem`,
          display: sourceMode ? "none" : undefined,
        }}
      />
      {sourceMode ? (
        <textarea
          className="rt-source"
          value={value}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: `${rows * 1.4}rem`,
            border: 0,
            borderTop: "1px solid #e5e7eb",
            padding: "0.75rem 0.9rem",
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: "0.82rem",
            lineHeight: 1.5,
            background: "#fafafa",
            color: "#0f172a",
            resize: "vertical",
            outline: "none",
          }}
        />
      ) : null}
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}
