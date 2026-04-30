"use client";

import { useState } from "react";
import type { Author, Category } from "@/lib/types";
import { FormModal } from "@/components/admin-ui/FormModal";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import { AuthorFields } from "./AuthorFields";
import {
  createAuthorAction,
  updateAuthorAction,
  deleteAuthorAction,
} from "./actions";

export function AuthorsClient({
  authors,
  categories,
}: {
  authors: Author[];
  categories: Category[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);

  const catName = new Map(categories.map((c) => [c.CatID, c.CatName]));

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Authors</h2>
          <div className="subtitle">
            Bylines for articles. Auto-created when a category is added.
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add Author
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th style={{ width: 80 }}>Photo</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Default category</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 180, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {authors.map((a) => (
              <tr key={a.AuthorID}>
                <td>{a.AuthorID}</td>
                <td>
                  {a.AvatarURL ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.AvatarURL}
                      alt={a.DisplayName}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "#e2e8f0",
                        color: "#64748b",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {a.DisplayName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                    </span>
                  )}
                </td>
                <td>{a.DisplayName}</td>
                <td><code>{a.Slug}</code></td>
                <td>
                  {a.FK_CatID != null
                    ? catName.get(a.FK_CatID) ?? `#${a.FK_CatID}`
                    : "—"}
                </td>
                <td>
                  {a.IsActive ? (
                    <span className="badge ok">active</span>
                  ) : (
                    <span className="badge off">inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setEditing(a)}
                  >
                    Edit
                  </button>{" "}
                  <RowDeleteButton
                    action={deleteAuthorAction}
                    id={a.AuthorID}
                    confirmTitle={`Delete "${a.DisplayName}"?`}
                    confirmDescription="The author will be soft-deleted. Existing posts keep their byline reference but the author won't be auto-assigned to new posts."
                    successMessage="Author deleted"
                  />
                </td>
              </tr>
            ))}
            {authors.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                  No authors yet. Add a category and one will be generated automatically.
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
          title="Add Author"
          size="lg"
          submitLabel="Create"
          successMessage="Author created"
          action={createAuthorAction}
        >
          <AuthorFields categories={categories} />
        </FormModal>
      ) : null}

      {editing ? (
        <FormModal
          open
          onClose={() => setEditing(null)}
          title={`Edit "${editing.DisplayName}"`}
          size="lg"
          submitLabel="Save changes"
          successMessage="Author updated"
          action={updateAuthorAction}
        >
          <AuthorFields categories={categories} value={editing} />
        </FormModal>
      ) : null}
    </>
  );
}
