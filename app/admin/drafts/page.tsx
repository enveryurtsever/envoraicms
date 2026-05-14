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

export const metadata = { title: "Drafts" };

const PAGE_SIZE = 30;

export default async function DraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  return (
    <Suspense
      key={`p${page}`}
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
      <DraftsData page={page} />
    </Suspense>
  );
}

async function DraftsData({ page }: { page: number }) {
  const offset = (page - 1) * PAGE_SIZE;
  const [newsDrafts, newsCounts, articleDrafts, articleCounts, categories] =
    await Promise.all([
      listRecentDrafts(PAGE_SIZE, offset),
      countDraftsByStatus(),
      listRecentArticleDrafts(PAGE_SIZE, offset),
      countArticleDraftsByStatus(),
      listAllCategories(),
    ]);
  return (
    <>
      <DraftsTabbed
        newsDrafts={newsDrafts}
        newsCounts={newsCounts}
        articleDrafts={articleDrafts}
        articleCounts={articleCounts}
        categories={categories}
      />
      {(newsDrafts.length === PAGE_SIZE || articleDrafts.length === PAGE_SIZE || page > 1) ? (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
          {page > 1 ? (
            <a href={page === 2 ? "/admin/drafts" : `/admin/drafts?page=${page - 1}`} className="btn secondary small">
              ← Previous
            </a>
          ) : null}
          {(newsDrafts.length === PAGE_SIZE || articleDrafts.length === PAGE_SIZE) ? (
            <a href={`/admin/drafts?page=${page + 1}`} className="btn secondary small">
              Next →
            </a>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
