"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LinkRow } from "@/lib/types";
import { FormModal } from "@/components/admin-ui/FormModal";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import { useToast } from "@/components/admin-ui/Toast";
import { LinkFields } from "./LinkFields";
import {
  createLinkAction,
  updateLinkAction,
  deleteLinkAction,
  generateCorePagesAction,
} from "./actions";

export function LinksClient({ links }: { links: LinkRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [generating, startGenerate] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function generateCore() {
    startGenerate(async () => {
      try {
        const r = await generateCorePagesAction();
        const parts: string[] = [];
        if (r.created.length) parts.push(`Created: ${r.created.join(", ")}`);
        if (r.skipped.length) parts.push(`Skipped: ${r.skipped.join(", ")}`);
        if (r.errors.length)
          parts.push(`Errors: ${r.errors.map((e) => e.slug).join(", ")}`);
        toast.success("Core pages", parts.join(" — ") || "Nothing to do.");
        router.refresh();
      } catch (err) {
        toast.error(
          "Generation failed",
          err instanceof Error ? err.message : "Unexpected error",
        );
      }
    });
  }

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Pages</h2>
          <div className="subtitle">Footer links, social icons, and standalone content pages.</div>
        </div>
        <div className="actions" style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn secondary"
            onClick={generateCore}
            disabled={generating}
            title="Auto-generate Privacy, Terms, and Contact pages with the configured Content AI"
          >
            {generating ? "Generating…" : "Generate core pages"}
          </button>
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add Page
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Title</th>
              <th>URL / slug</th>
              <th style={{ width: 70 }}>Order</th>
              <th style={{ width: 130 }}>Placement</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 180, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.LinkID}>
                <td>{l.LinkID}</td>
                <td>
                  {l.LinkTitle}
                  {l.LinkIcon ? (
                    <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "#6b7280" }}>
                      <code>{l.LinkIcon}</code>
                    </span>
                  ) : null}
                </td>
                <td style={{ fontSize: "0.75rem" }}>
                  {l.Link ? <code>{l.Link}</code> : null}
                  {l.LinkSeo ? (
                    <div>
                      <code>/l/{l.LinkSeo}</code>
                    </div>
                  ) : null}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{l.LinkNumber ?? 0}</td>
                <td>
                  {l.TopMenu ? <span className="badge">Top</span> : null}{" "}
                  {l.Footer ? <span className="badge">Footer</span> : null}
                </td>
                <td>
                  {(l as { IsActive?: boolean }).IsActive !== false ? (
                    <span className="badge ok">active</span>
                  ) : (
                    <span className="badge off">inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setEditing(l)}
                  >
                    Edit
                  </button>{" "}
                  <RowDeleteButton
                    action={deleteLinkAction}
                    id={l.LinkID}
                    confirmTitle={`Delete "${l.LinkTitle}"?`}
                    confirmDescription="The link will be soft-deleted and removed from all menus."
                    successMessage="Link deleted"
                  />
                </td>
              </tr>
            ))}
            {links.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                  No links yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {creating ? (
        <FormModal
          open
          onClose={() => setCreating(false)}
          title="Add Page"
          size="lg"
          submitLabel="Create"
          successMessage="Page created"
          action={createLinkAction}
        >
          <LinkFields />
        </FormModal>
      ) : null}

      {editing ? (
        <FormModal
          open
          onClose={() => setEditing(null)}
          title={`Edit "${editing.LinkTitle}"`}
          size="lg"
          submitLabel="Save changes"
          successMessage="Link updated"
          action={updateLinkAction}
        >
          <LinkFields value={editing} />
        </FormModal>
      ) : null}
    </>
  );
}
