"use client";

import dynamic from "next/dynamic";
import type { LinkRow } from "@/lib/types";

// Same lazy pattern as AuthorFields — keeps the editor chunk out of the
// /admin/links initial bundle until the modal opens.
const RichTextEditor = dynamic(
  () =>
    import("@/components/admin-ui/RichTextEditor").then((m) => ({
      default: m.RichTextEditor,
    })),
  { ssr: false },
);

export function LinkFields({ value }: { value?: LinkRow }) {
  const v = value;
  return (
    <>
      {v ? <input type="hidden" name="id" defaultValue={v.LinkID} /> : null}
      <h4 style={section}>Basics</h4>
      <Row label="Title *" name="LinkTitle" defaultValue={v?.LinkTitle} />
      <Row
        label="URL"
        name="Link"
        defaultValue={v?.Link}
        hint="external URL (for social icons) or an internal path starting with /"
      />
      <Row
        label="Icon"
        name="LinkIcon"
        defaultValue={v?.LinkIcon}
        hint="social icon name; leave blank to treat this as a content page link"
      />
      <Row
        label="SEO slug"
        name="LinkSeo"
        defaultValue={v?.LinkSeo}
        hint="if filled, /l/<slug> renders a static content page"
      />
      <Row label="Sort order" name="LinkNumber" type="number" defaultValue={String(v?.LinkNumber ?? 0)} />

      <h4 style={section}>Placement</h4>
      <Row label="Top menu" name="TopMenu" type="checkbox" checked={v?.TopMenu ?? false} />
      <Row label="Footer"   name="Footer"  type="checkbox" checked={v?.Footer ?? false} />
      <Row
        label="Active"
        name="IsActive"
        type="checkbox"
        checked={(v as { IsActive?: boolean } | undefined)?.IsActive ?? true}
      />

      <h4 style={section}>Static page content</h4>
      <div className="form-row">
        <label htmlFor="LinkContent">Body</label>
        <div>
          <RichTextEditor
            name="LinkContent"
            defaultValue={v?.LinkContent ?? ""}
            rows={14}
          />
          <small>Sanitized server-side. Rendered at /s/&lt;slug&gt;.</small>
        </div>
      </div>
    </>
  );
}

const section: React.CSSProperties = {
  margin: "0.4rem 0 0.6rem",
  fontSize: "0.85rem",
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

function Row({
  label,
  name,
  defaultValue,
  type = "text",
  checked,
  textarea,
  big,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  checked?: boolean;
  textarea?: boolean;
  big?: boolean;
  hint?: string;
}) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <div>
        {type === "checkbox" ? (
          <input id={name} name={name} type="checkbox" defaultChecked={checked ?? false} />
        ) : textarea ? (
          <textarea
            id={name}
            name={name}
            defaultValue={defaultValue ?? ""}
            style={big ? { minHeight: 240, fontFamily: "ui-monospace, SF Mono, monospace" } : undefined}
          />
        ) : (
          <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} />
        )}
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}
