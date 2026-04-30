"use client";

import { useEffect, useRef, useState } from "react";

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
 *  the existing FormData/server-action flow works unchanged. */
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
  const value = controlled ?? internal;

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== defaultValue) {
      editorRef.current.innerHTML = defaultValue;
    }
    // We intentionally do not re-run on local edits — that would fight the
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

  function sync() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    if (controlled === undefined) setInternal(html);
    onChange?.(html);
  }

  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg);
    editorRef.current?.focus();
    sync();
  }

  function applyBlock(tag: string) {
    document.execCommand("formatBlock", false, tag);
    editorRef.current?.focus();
    sync();
  }

  function insertLink() {
    const url = prompt("URL");
    if (!url) return;
    exec("createLink", url);
  }

  function clearFormatting() {
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
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        ref={editorRef}
        className="rt-canvas"
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder ?? "Start typing…"}
        style={{ minHeight: `${rows * 1.4}rem` }}
      />
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}
