"use client";

import { useState } from "react";
import type { AdZone } from "@/lib/queries/adzones";
import { FormModal } from "@/components/admin-ui/FormModal";
import { AdSlotFields } from "./AdSlotFields";
import { saveAdZoneAction } from "./actions";

type SlotDef = {
  slot: string;
  label: string;
  hint: string;
};

const SLOTS: SlotDef[] = [
  { slot: "leaderboard-top",    label: "Top banner",         hint: "Below the header, every page." },
  { slot: "leaderboard-bottom", label: "Bottom banner",      hint: "End of every page, after the content." },
  { slot: "billboard",          label: "Billboard",          hint: "Homepage middle, above the latest list." },
  { slot: "sidebar-mpu",        label: "Sidebar MPU",        hint: "Article right column 300x250." },
  { slot: "sidebar-half",       label: "Sidebar half-page",  hint: "Article right column 300x600." },
  { slot: "in-article",         label: "In-article",         hint: "Mid-article detail." },
];

export function AdsClient({ zones }: { zones: AdZone[] }) {
  const bySlot = new Map<string, AdZone>(zones.map((z) => [z.Slot, z]));
  const [editing, setEditing] = useState<SlotDef | null>(null);

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Ads</h2>
          <div className="subtitle">
            Per-slot ad inventory. Inactive slots render nothing.
          </div>
        </div>
      </div>

      <div className="alert warn" role="note">
        <strong>Heads up — HTML is NOT sanitized.</strong> Whatever you paste into the
        snippet box (AdSense / GAM / custom <code>&lt;script&gt;</code>) is served to
        visitors as-is. Only the <em>admin</em> role can edit these slots. Inactive slots
        render nothing at all, and turning off <code>Settings.AdsEnabled</code> hides every
        slot at once.
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Snippet</th>
              <th style={{ width: 110 }}>Window</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 140, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((s) => {
              const z = bySlot.get(s.slot);
              const hasSnippet = !!z?.HtmlSnippet?.trim();
              return (
                <tr key={s.slot}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.label}</div>
                    <code style={{ fontSize: "0.72rem", color: "#64748b" }}>{s.slot}</code>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>
                      {s.hint}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.78rem" }}>
                    {hasSnippet ? (
                      <span style={{ color: "#065f46" }}>configured</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>empty</span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.72rem", color: "#64748b" }}>
                    {z?.StartsAt || z?.EndsAt ? "scheduled" : "always"}
                  </td>
                  <td>
                    {z?.IsActive ? (
                      <span className="badge ok">active</span>
                    ) : (
                      <span className="badge off">inactive</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => setEditing(s)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing ? (
        <FormModal
          open
          onClose={() => setEditing(null)}
          title={`Edit slot — ${editing.label}`}
          size="lg"
          submitLabel="Save slot"
          successMessage="Ad slot updated"
          action={saveAdZoneAction}
        >
          <AdSlotFields
            slot={editing.slot}
            defaultLabel={editing.label}
            zone={bySlot.get(editing.slot)}
          />
        </FormModal>
      ) : null}
    </>
  );
}
