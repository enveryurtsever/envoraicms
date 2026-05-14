import { Suspense } from "react";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { TableSkeleton } from "@/components/admin-ui/Skeletons";
import { CategoriesClient } from "./CategoriesClient";

/** Shell + Suspense — page paints instantly with a skeleton; the client
 *  table swaps in once `listAllCategories` resolves. */
export const metadata = { title: "Categories" };

export default function CategoriesPage() {
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
      <CategoriesData />
    </Suspense>
  );
}

async function CategoriesData() {
  const cats = await listAllCategories();
  return <CategoriesClient categories={cats} />;
}
