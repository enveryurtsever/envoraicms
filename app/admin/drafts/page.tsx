import {
  countDraftsByStatus,
  listRecentDrafts,
} from "@/lib/ingest/drafts";
import {
  countArticleDraftsByStatus,
  listRecentArticleDrafts,
} from "@/lib/ingest/article-drafts";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { DraftsTabbed } from "./DraftsTabbed";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
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
