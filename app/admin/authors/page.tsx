import { Suspense } from "react";
import { listAuthors } from "@/lib/queries/authors";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { TableSkeleton } from "@/components/admin-ui/Skeletons";
import { AuthorsClient } from "./AuthorsClient";

export const dynamic = "force-dynamic";

export default function AuthorsPage() {
  return (
    <Suspense
      fallback={
        <>
          <div className="admin-header">
            <div>
              <div className="adm-skel adm-skel-title" />
              <div className="adm-skel adm-skel-sub" />
            </div>
          </div>
          <TableSkeleton rows={6} cols={6} />
        </>
      }
    >
      <AuthorsData />
    </Suspense>
  );
}

async function AuthorsData() {
  const [authors, cats] = await Promise.all([listAuthors(), listAllCategories()]);
  return <AuthorsClient authors={authors} categories={cats} />;
}
