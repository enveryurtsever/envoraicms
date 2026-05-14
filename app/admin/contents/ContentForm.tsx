import type { Category, Content } from "@/lib/types";
import { AIField } from "./AIField";
import { ImageRegenerator } from "./ImageRegenerator";

function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export default function ContentForm({
  categories,
  value,
}: {
  categories: Category[];
  value?: Content;
}) {
  const v = value;
  const src = v?.ContentSource ?? null;
  return (
    <>
      <div className="card">
        <h3>Titles</h3>
        <AIField
          fieldKey="title"
          name="ContentTitle"
          label="Title *"
          initialValue={v?.ContentTitle}
          contextFields={["ContentShort", "ContentKeywords", "ContentDetail"]}
        />
        <Row
          label="SEO slug"
          name="ContentSeo"
          defaultValue={v?.ContentSeo}
          hint="leave blank to auto-generate from the title"
        />
        <Row label="Alternate title" name="ContentAlternateTitle" defaultValue={v?.ContentAlternateTitle} />
        <Row label="Original title" name="ContentOriginalTitle" defaultValue={v?.ContentOriginalTitle} />
      </div>

      <div className="card">
        <h3>Body</h3>
        <AIField
          fieldKey="short"
          name="ContentShort"
          label="Lede / summary"
          initialValue={v?.ContentShort}
          contextFields={["ContentTitle", "ContentKeywords", "ContentDetail"]}
          textarea
          hint="also used as the meta description fallback"
        />
        <AIField
          fieldKey="desc"
          name="ContentDesc"
          label="Meta description"
          initialValue={v?.ContentDesc}
          contextFields={["ContentTitle", "ContentShort", "ContentKeywords"]}
          textarea
        />
        <AIField
          fieldKey="keywords"
          name="ContentKeywords"
          label="Keywords"
          initialValue={v?.ContentKeywords}
          contextFields={["ContentTitle", "ContentShort", "ContentDetail"]}
          hint="comma-separated"
        />
        <AIField
          fieldKey="detail"
          name="ContentDetail"
          label="Detail"
          initialValue={v?.ContentDetail}
          contextFields={["ContentTitle", "ContentShort", "ContentDesc", "ContentKeywords"]}
          rich
          big
          hint="Output is sanitized server-side. Use the toolbar for headings, lists, and links."
        />
      </div>

      <div className="card">
        <h3>Placement</h3>
        <div className="form-row">
          <label htmlFor="FK_CatID">Category *</label>
          <select id="FK_CatID" name="FK_CatID" defaultValue={v?.FK_CatID ?? ""}>
            <option value="">(select)</option>
            {categories.map((c) => (
              <option key={c.CatID} value={c.CatID}>
                {c.CatName}
              </option>
            ))}
          </select>
        </div>
        <Row
          label="Publish date"
          name="PublishDate"
          type="datetime-local"
          defaultValue={toLocalInput(v?.PublishDate ?? new Date())}
        />
        <Row
          label="On homepage"
          name="Homepage"
          type="checkbox"
          checked={v?.Homepage ?? false}
        />
        <Row
          label="Active"
          name="IsActive"
          type="checkbox"
          checked={v?.IsActive ?? true}
        />
      </div>

      <div className="card">
        <h3>Media</h3>
        <ImageRow
          label="Image"
          name="ContentImage"
          fileName="ContentImageFile"
          value={v?.ContentImage ?? null}
          hint="Upload to /Upload/content/, paste a URL, or use the AI image generator below."
        />
        <AIField
          fieldKey="imagePrompt"
          name="ImagePrompt"
          label="Image AI prompt"
          initialValue={v?.ImagePrompt}
          contextFields={["ContentTitle", "ContentShort", "ContentKeywords"]}
          textarea
          hint="when an image_ai provider (e.g. fal.ai) is active, the 'Regenerate image' button uses this prompt"
        />
        <ImageRegenerator
          contentId={v?.ContentID ?? null}
          initialImage={v?.ContentImage ?? null}
        />
        <Row label="Video URL" name="ContentVideo" defaultValue={v?.ContentVideo} />
      </div>

      <div className="card">
        <h3>Source</h3>
        <Row label="Source URL" name="SourceHref" defaultValue={src?.href} />
        <Row label="Source title" name="SourceTitle" defaultValue={src?.title} />
        <Row label="Content URL (legacy)" name="ContentURL" defaultValue={v?.ContentURL} />
      </div>
    </>
  );
}

function ImageRow({
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
                maxHeight: 120,
                maxWidth: 320,
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
          placeholder="/Upload/content/xxx.webp"
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
          <input
            id={name}
            name={name}
            type="checkbox"
            defaultChecked={checked ?? false}
          />
        ) : textarea ? (
          <textarea
            id={name}
            name={name}
            defaultValue={defaultValue ?? ""}
            style={big ? { minHeight: 320, fontFamily: "ui-monospace, SF Mono, monospace" } : undefined}
          />
        ) : (
          <input
            id={name}
            name={name}
            type={type}
            defaultValue={defaultValue ?? ""}
          />
        )}
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}
