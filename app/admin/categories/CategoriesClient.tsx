"use client";

import { useState } from "react";
import type { Category } from "@/lib/types";
import { FormModal } from "@/components/admin-ui/FormModal";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import { CategoryFields } from "./CategoryFields";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "./actions";

export function CategoriesClient({ categories }: { categories: Category[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const byId = new Map(categories.map((c) => [c.CatID, c.CatName]));

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Categories</h2>
          <div className="subtitle">Top-level taxonomy for content.</div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add Category
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Parent</th>
              <th style={{ width: 80 }}>Order</th>
              <th style={{ width: 130 }}>Menus</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 180, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.CatID}>
                <td>{c.CatID}</td>
                <td>{c.CatName}</td>
                <td><code>{c.CatSeo}</code></td>
                <td>{c.ParentCatID > 0 ? byId.get(c.ParentCatID) ?? c.ParentCatID : "—"}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{c.CatNumber}</td>
                <td style={{ display: "flex", gap: 4 }}>
                  {c.HeaderMenu ? <span className="badge">H</span> : null}
                  {c.FooterMenu ? <span className="badge">F</span> : null}
                  {c.SideMenu ? <span className="badge">S</span> : null}
                  {c.DropdownMenu ? <span className="badge">D</span> : null}
                </td>
                <td>
                  {c.IsActive ? (
                    <span className="badge ok">active</span>
                  ) : (
                    <span className="badge off">inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setEditing(c)}
                  >
                    Edit
                  </button>{" "}
                  <RowDeleteButton
                    action={deleteCategoryAction}
                    id={c.CatID}
                    confirmTitle={`Delete "${c.CatName}"?`}
                    confirmDescription="The category will be soft-deleted. Articles attached to it stay but lose their parent."
                    successMessage="Category deleted"
                  />
                </td>
              </tr>
            ))}
            {categories.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                  No categories yet.
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
          title="Add Category"
          size="lg"
          submitLabel="Create"
          successMessage="Category created"
          action={createCategoryAction}
        >
          <CategoryFields categories={categories} />
        </FormModal>
      ) : null}

      {editing ? (
        <FormModal
          open
          onClose={() => setEditing(null)}
          title={`Edit "${editing.CatName}"`}
          size="lg"
          submitLabel="Save changes"
          successMessage="Category updated"
          action={updateCategoryAction}
        >
          <CategoryFields categories={categories} value={editing} />
        </FormModal>
      ) : null}
    </>
  );
}
