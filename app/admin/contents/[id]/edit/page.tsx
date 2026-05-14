import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContentById } from "@/lib/queries/admin-contents";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { FormSkeleton } from "@/components/admin-ui/Skeletons";
import { updateContentAction } from "../../actions";
import ContentForm from "../../ContentForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contentId = Number(id);
  if (!Number.isFinite(contentId)) return { title: "Edit article" };
  const c = await getAdminContentById(contentId);
  return { title: c ? `Edit: ${c.ContentTitle}` : "Edit article" };
}

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

  return (
    <>
      <div className="admin-header">
        <h2>Edit article</h2>
        <Link href="/admin/contents" className="btn secondary">
          ← Back
        </Link>
      </div>
      {sp.saved ? <div className="alert success">Kaydedildi.</div> : null}

      <Suspense fallback={<FormSkeleton rows={6} />}>
        <EditContentForm contentId={contentId} />
      </Suspense>
    </>
  );
}

// Async data section — streams behind Suspense so the page header (title +
// Back button) paints before the Contents row + body blob arrive. The
// ContentDetail field can be many KB of HTML, so this matters for slow
// connections.
async function EditContentForm({ contentId }: { contentId: number }) {
  const [content, cats] = await Promise.all([
    getAdminContentById(contentId),
    listAllCategories(),
  ]);
  if (!content) notFound();

  const action = updateContentAction.bind(null, contentId);
  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <Link
          href={`/s/${content.ContentSeo}`}
          target="_blank"
          className="btn secondary"
        >
          Preview ↗
        </Link>
      </div>
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
