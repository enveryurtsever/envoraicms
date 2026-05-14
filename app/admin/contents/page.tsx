import { Suspense } from "react";
import Link from "next/link";
import {
  countAdminContents,
  listAdminContents,
} from "@/lib/queries/admin-contents";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { FilterBarSkeleton, TableSkeleton } from "@/components/admin-ui/Skeletons";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import { LocalDate } from "@/components/admin-ui/LocalDate";
import { IconExternalLink } from "@/components/admin-ui/Icon";
import { deleteContentAction } from "./actions";

const PAGE_SIZE = 30;

/** Page returns the static shell synchronously — header + Suspense fallback
 *  paint immediately on click. Data sections stream in behind Suspense. */
export const metadata = { title: "Articles" };

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    cat?: string;
    q?: string;
    deleted?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const catId = sp.cat ? Number(sp.cat) : null;
  const q = sp.q?.trim() || null;

  return (
    <>
      <div className="admin-header">
        <h2>Articles</h2>
        <Link href="/admin/contents/new" className="btn">
          Add Article
        </Link>
      </div>
      {sp.deleted ? <div className="alert success">Content deleted.</div> : null}

      <Suspense
        key={`${page}|${catId ?? ""}|${q ?? ""}`}
        fallback={
          <>
            <FilterBarSkeleton />
            <TableSkeleton rows={8} cols={6} />
          </>
        }
      >
        <ContentsTable page={page} catId={catId} q={q} />
      </Suspense>
    </>
  );
}

async function ContentsTable({
  page,
  catId,
  q,
}: {
  page: number;
  catId: number | null;
  q: string | null;
}) {
  const [items, total, cats] = await Promise.all([
    listAdminContents({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      catId,
      q,
    }),
    countAdminContents({ catId, q }),
    listAllCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildHref = (p: number) => {
    const u = new URLSearchParams();
    if (catId) u.set("cat", String(catId));
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `/admin/contents?${s}` : "/admin/contents";
  };

  return (
    <>
      <form method="get" className="card" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <select name="cat" defaultValue={catId ?? ""} style={{ padding: "0.45rem" }}>
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.CatID} value={c.CatID}>
              {c.CatName}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title / description…"
          style={{ flex: 1, padding: "0.45rem 0.65rem", border: "1px solid #d1d5db", borderRadius: 6 }}
        />
        <button type="submit" className="btn secondary">
          Filter
        </button>
      </form>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th>Title</th>
              <th style={{ width: 140 }}>Category</th>
              <th style={{ width: 140 }}>Published</th>
              <th style={{ width: 90 }}>Views</th>
              <th style={{ width: 80 }}>Status</th>
              <th style={{ width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.ContentID}>
                <td>{c.ContentID}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Link
                      href={`/admin/contents/${c.ContentID}/edit`}
                      style={{
                        fontWeight: 500,
                        color: "inherit",
                        textDecoration: "none",
                      }}
                      title="Edit article"
                    >
                      {c.ContentTitle}
                    </Link>
                    {c.CatSeo && c.ContentSeo ? (
                      <a
                        href={`/${c.CatSeo}/${c.ContentSeo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open on site"
                        aria-label="Open on site"
                        style={{
                          color: "#64748b",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <IconExternalLink size={14} />
                      </a>
                    ) : null}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    <code>{c.ContentSeo}</code>
                    {c.Homepage ? (
                      <span
                        className="badge ok"
                        style={{ marginLeft: 6 }}
                        title="Featured on the homepage"
                      >
                        HP
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>{c.CatName}</td>
                <td style={{ fontSize: "0.75rem" }}>
                  <LocalDate value={c.PublishDate} />
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {c.ViewCount.toLocaleString(undefined)}
                </td>
                <td>
                  {c.IsActive ? (
                    <span className="badge ok">active</span>
                  ) : (
                    <span className="badge off">inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link
                    href={`/admin/contents/${c.ContentID}/edit`}
                    className="btn secondary small"
                  >
                    Edit
                  </Link>{" "}
                  <RowDeleteButton
                    action={deleteContentAction}
                    id={c.ContentID}
                    confirmTitle={`Delete "${c.ContentTitle}"?`}
                    confirmDescription="The article will be soft-deleted and unpublished."
                    successMessage="Article deleted"
                  />
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                  No content yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
        <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          Total {total} — page {page}/{totalPages}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className="btn secondary small">
              ← Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link href={buildHref(page + 1)} className="btn secondary small">
              Next →
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
