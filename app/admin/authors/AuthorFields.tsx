"use client";

import type { Author, Category } from "@/lib/types";
import { RichTextEditor } from "@/components/admin-ui/RichTextEditor";

export function AuthorFields({
  categories,
  value,
}: {
  categories: Category[];
  value?: Author;
}) {
  const v = value;
  return (
    <>
      {v ? <input type="hidden" name="id" defaultValue={v.AuthorID} /> : null}

      <Row
        label="Display name *"
        name="DisplayName"
        defaultValue={v?.DisplayName}
        placeholder="e.g. Jane Smith"
        hint="The byline shown on every article this author writes."
      />
      <Row
        label="URL slug"
        name="Slug"
        defaultValue={v?.Slug}
        placeholder="auto-generated if blank"
        hint="Lowercase letters, numbers, dashes."
      />
      <div className="form-row">
        <label htmlFor="Bio">Bio</label>
        <div>
          <RichTextEditor name="Bio" defaultValue={v?.Bio ?? ""} />
          <small>Short bio shown next to articles. Plain text or basic formatting.</small>
        </div>
      </div>
      <Row
        label="Email"
        name="Email"
        defaultValue={v?.Email}
        placeholder="optional"
      />
      <div className="form-row">
        <label htmlFor="FK_CatID">Default category</label>
        <div>
          <select id="FK_CatID" name="FK_CatID" defaultValue={v?.FK_CatID ?? ""}>
            <option value="">(any)</option>
            {categories.map((c) => (
              <option key={c.CatID} value={c.CatID}>
                {c.CatName}
              </option>
            ))}
          </select>
          <small>Posts in this category will default to this author.</small>
        </div>
      </div>
      <ImageUploadRow
        label="Profile photo"
        name="AvatarURL"
        fileName="AvatarFile"
        value={v?.AvatarURL ?? null}
        hint="Square 256×256 recommended. Saved to /Upload/author/."
      />
      <Row
        label="Active"
        name="IsActive"
        type="switch"
        checked={v?.IsActive ?? true}
        hint="Inactive authors aren't auto-assigned to new posts."
      />
    </>
  );
}

function Row({
  label,
  name,
  defaultValue,
  type = "text",
  checked,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: "text" | "switch";
  checked?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <div>
        {type === "switch" ? (
          <input
            id={name}
            name={name}
            type="checkbox"
            defaultChecked={checked ?? false}
            className="switch"
          />
        ) : (
          <input
            id={name}
            name={name}
            type="text"
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
          />
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
                width: 96,
                height: 96,
                borderRadius: "50%",
                objectFit: "cover",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
              }}
            />
          </div>
        ) : null}
        <input
          id={name}
          name={name}
          type="text"
          defaultValue={value ?? ""}
          placeholder="/Upload/author/..."
        />
        <div style={{ marginTop: "0.4rem" }}>
          <input
            id={fileName}
            name={fileName}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
          />
        </div>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}
