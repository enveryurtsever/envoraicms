"use client";

import type { Category } from "@/lib/types";
import { AIInputRow } from "@/components/admin-ui/AIWand";

export function CategoryFields({
  categories,
  value,
}: {
  categories: Category[];
  value?: Category;
}) {
  const v = value;
  return (
    <>
      {v ? <input type="hidden" name="id" defaultValue={v.CatID} /> : null}

      <Section
        title="Basics"
        description="The name shown in menus and the URL slug used in links."
      >
        <Row
          label="Name *"
          name="CatName"
          defaultValue={v?.CatName}
          placeholder="e.g. Technology"
          hint="Shown in menus, breadcrumbs, and listings."
        />
        <Row
          label="URL slug"
          name="CatSeo"
          defaultValue={v?.CatSeo}
          placeholder="auto-generated if blank"
          hint="Lowercase letters, numbers, and dashes. Used in URLs like /technology."
        />
        <AIInputRow
          label="SEO title"
          name="CatTitle"
          defaultValue={v?.CatTitle}
          placeholder="defaults to the name"
          fieldKey="title"
          contextMap={{ title: "CatName", short: "CatDesc", keywords: "CatKeywords" }}
          hint="The <title> tag for the category page. Leave blank to use the name."
        />
        <AIInputRow
          label="Description"
          name="CatDesc"
          defaultValue={v?.CatDesc}
          textarea
          placeholder="What is this category about?"
          fieldKey="desc"
          contextMap={{ title: "CatName", keywords: "CatKeywords" }}
          hint="Used as the meta description on the category page."
        />
        <AIInputRow
          label="Keywords"
          name="CatKeywords"
          defaultValue={v?.CatKeywords}
          placeholder="ai, technology, gadgets"
          fieldKey="keywords"
          contextMap={{ title: "CatName", short: "CatDesc" }}
          hint="Comma-separated. Optional — search engines mostly ignore meta keywords."
        />
        <ImageUploadRow
          label="Cover image"
          name="CatImage"
          fileName="CatImageFile"
          value={v?.CatImage ?? null}
          hint="Optional banner image. Uploaded files are saved to /Upload/category/."
        />
      </Section>

      <Section
        title="Where should it appear?"
        description="Tick the menus this category should show up in. Categories are reusable — they can appear in multiple places."
      >
        <div className="form-row">
          <label htmlFor="ParentCatID">Parent category</label>
          <div>
            <select
              id="ParentCatID"
              name="ParentCatID"
              defaultValue={v?.ParentCatID ?? 0}
            >
              <option value={0}>(top level)</option>
              {categories
                .filter((c) => !v || c.CatID !== v.CatID)
                .map((c) => (
                  <option key={c.CatID} value={c.CatID}>
                    {c.CatName}
                  </option>
                ))}
            </select>
            <small>
              Pick a parent to nest this category. &quot;Top level&quot; means it appears at the
              root.
            </small>
          </div>
        </div>
        <Row
          label="Sort order"
          name="CatNumber"
          type="number"
          defaultValue={String(v?.CatNumber ?? 0)}
          hint="Lower numbers come first. Use 0, 10, 20… so you can squeeze items in later."
        />
        <Row
          label="Top menu"
          name="HeaderMenu"
          type="switch"
          checked={v?.HeaderMenu ?? true}
          hint="Show in the main navigation at the top of every page."
        />
        <Row
          label="Footer menu"
          name="FooterMenu"
          type="switch"
          checked={v?.FooterMenu ?? false}
          hint="Show in the site footer."
        />
        <Row
          label="Side menu"
          name="SideMenu"
          type="switch"
          checked={v?.SideMenu ?? false}
          hint="Show in the sidebar (themes that have a sidebar)."
        />
        <Row
          label="Dropdown menu"
          name="DropdownMenu"
          type="switch"
          checked={v?.DropdownMenu ?? false}
          hint="Show in the &quot;more&quot; / &quot;all topics&quot; dropdown."
        />
        <Row
          label="Active"
          name="IsActive"
          type="switch"
          checked={v?.IsActive ?? true}
          hint="Uncheck to hide this category everywhere without deleting it."
        />
      </Section>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 600, color: "#0f172a" }}>
        {title}
      </h4>
      <p style={{ margin: "0 0 0.85rem", fontSize: "0.82rem", color: "#64748b" }}>
        {description}
      </p>
      {children}
    </section>
  );
}

function Row({
  label,
  name,
  defaultValue,
  type = "text",
  checked,
  textarea,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: "text" | "number" | "switch" | "checkbox";
  checked?: boolean;
  textarea?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <div>
        {type === "checkbox" || type === "switch" ? (
          <input
            id={name}
            name={name}
            type="checkbox"
            defaultChecked={checked ?? false}
            className={type === "switch" ? "switch" : undefined}
          />
        ) : textarea ? (
          <textarea id={name} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
        ) : (
          <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
        )}
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

function ImageUploadRow({
  label,
  name,
  fileName,
  value,
  hint,
}: {
  label: string;
  name: string;
  fileName: string;
  value: string | null;
  hint?: string;
}) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <div>
        {value ? (
          <div style={{ marginBottom: "0.5rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              style={{
                maxHeight: 100,
                maxWidth: 280,
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                padding: 4,
              }}
            />
          </div>
        ) : null}
        <input
          id={name}
          name={name}
          type="text"
          defaultValue={value ?? ""}
          placeholder="/Upload/category/..."
        />
        <div style={{ marginTop: "0.4rem" }}>
          <input
            id={fileName}
            name={fileName}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          />
        </div>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}
