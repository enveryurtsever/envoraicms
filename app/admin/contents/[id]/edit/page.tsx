import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContentById } from "@/lib/queries/admin-contents";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { updateContentAction } from "../../actions";
import ContentForm from "../../ContentForm";

export const dynamic = "force-dynamic";

export default async function EditContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const contentId = Number(id);
  if (!Number.isFinite(contentId)) notFound();

  const [content, cats] = await Promise.all([
    getAdminContentById(contentId),
    listAllCategories(),
  ]);
  if (!content) notFound();

  const action = updateContentAction.bind(null, contentId);

  return (
    <>
      <div className="admin-header">
        <h2>Content: {content.ContentTitle}</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href={`/s/${content.ContentSeo}`}
            target="_blank"
            className="btn secondary"
          >
            Preview ↗
          </Link>
          <Link href="/admin/contents" className="btn secondary">
            ← Back
          </Link>
        </div>
      </div>
      {sp.saved ? <div className="alert success">Kaydedildi.</div> : null}

      <form action={action}>
        <ContentForm categories={cats} value={content} />
        <div style={{ marginTop: "1rem" }}>
          <button type="submit" className="btn">
            Save
          </button>
        </div>
      </form>
    </>
  );
}
