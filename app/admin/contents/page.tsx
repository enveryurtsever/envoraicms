import Link from "next/link";
import {
  countAdminContents,
  listAdminContents,
} from "@/lib/queries/admin-contents";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { deleteContentAction } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

function fmt(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleString(undefined, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

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
      <div className="admin-header">
        <h2>Articles</h2>
        <Link href="/admin/contents/new" className="btn">
          Add Article
        </Link>
      </div>
      {sp.deleted ? <div className="alert success">Content deleted.</div> : null}

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
                  <div style={{ fontWeight: 500 }}>{c.ContentTitle}</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    <code>{c.ContentSeo}</code>
                    {c.Homepage ? <span className="badge ok" style={{ marginLeft: 6 }}>HP</span> : null}
                  </div>
                </td>
                <td>{c.CatName}</td>
                <td style={{ fontSize: "0.75rem" }}>{fmt(c.PublishDate)}</td>
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
                  <form action={deleteContentAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={c.ContentID} />
                    <button type="submit" className="btn danger small">
                      Delete
                    </button>
                  </form>
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
