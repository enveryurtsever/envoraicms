import { Suspense } from "react";
import {
  countDraftsByStatus,
  listRecentDrafts,
} from "@/lib/ingest/drafts";
import {
  countArticleDraftsByStatus,
  listRecentArticleDrafts,
} from "@/lib/ingest/article-drafts";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { TableSkeleton } from "@/components/admin-ui/Skeletons";
import { DraftsTabbed } from "./DraftsTabbed";

export const dynamic = "force-dynamic";

export default function DraftsPage() {
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
          <TableSkeleton rows={8} cols={5} />
        </>
      }
    >
      <DraftsData />
    </Suspense>
  );
}

async function DraftsData() {
  const [newsDrafts, newsCounts, articleDrafts, articleCounts, categories] =
    await Promise.all([
      listRecentDrafts(100),
      countDraftsByStatus(),
      listRecentArticleDrafts(100),
      countArticleDraftsByStatus(),
      listAllCategories(),
    ]);
  return (
    <DraftsTabbed
      newsDrafts={newsDrafts}
      newsCounts={newsCounts}
      articleDrafts={articleDrafts}
      articleCounts={articleCounts}
      categories={categories}
    />
  );
}
