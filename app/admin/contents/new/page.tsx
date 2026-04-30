import Link from "next/link";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { createContentAction } from "../actions";
import ContentForm from "../ContentForm";

export const dynamic = "force-dynamic";

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [cats, sp] = await Promise.all([listAllCategories(), searchParams]);

  return (
    <>
      <div className="admin-header">
        <h2>New content</h2>
        <Link href="/admin/contents" className="btn secondary">
          ← Back
        </Link>
      </div>
      {sp.error === "missing" ? (
        <div className="alert error">Title, slug and category are required.</div>
      ) : null}

      <form action={createContentAction} autoComplete="off">
        <ContentForm categories={cats} />
        <div style={{ marginTop: "1rem" }}>
          <button type="submit" className="btn">
            Create
          </button>
        </div>
      </form>
    </>
  );
}
