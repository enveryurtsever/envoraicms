"use client";

import type { AdZone } from "@/lib/queries/adzones";

function toInput(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdSlotFields({
  slot,
  defaultLabel,
  zone,
}: {
  slot: string;
  defaultLabel: string;
  zone?: AdZone;
}) {
  return (
    <>
      <input type="hidden" name="slot" value={slot} />

      <div className="form-row">
        <label htmlFor="label">Label</label>
        <input
          id="label"
          type="text"
          name="label"
          defaultValue={zone?.Label ?? defaultLabel}
          placeholder="Campaign name / description"
        />
      </div>

      <div className="form-row">
        <label htmlFor="htmlSnippet">HTML snippet</label>
        <div>
          <textarea
            id="htmlSnippet"
            name="htmlSnippet"
            defaultValue={zone?.HtmlSnippet ?? ""}
            rows={9}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}
            placeholder='<ins class="adsbygoogle" ... ></ins>'
          />
          <small>
            Paste AdSense / GAM / custom code as-is. <strong>Not sanitized.</strong>{" "}
            Leave blank to render nothing for this slot.
          </small>
        </div>
      </div>

      <div className="form-row">
        <label htmlFor="startsAt">Start</label>
        <input
          id="startsAt"
          type="datetime-local"
          name="startsAt"
          defaultValue={toInput(zone?.StartsAt ?? null)}
        />
      </div>
      <div className="form-row">
        <label htmlFor="endsAt">End</label>
        <input
          id="endsAt"
          type="datetime-local"
          name="endsAt"
          defaultValue={toInput(zone?.EndsAt ?? null)}
        />
      </div>

      <div className="form-row">
        <label htmlFor="note">Note</label>
        <input
          id="note"
          type="text"
          name="note"
          defaultValue={zone?.ImpressionNote ?? ""}
          placeholder="AdSense responsive, client=ca-pub-..."
        />
      </div>

      <div className="form-row">
        <label>Active</label>
        <label style={{ fontWeight: 400, padding: 0, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={zone?.IsActive ?? false}
            className="switch"
          />
          Serve this slot
        </label>
      </div>
    </>
  );
}
