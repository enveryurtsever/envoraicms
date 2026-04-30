"use client";

import type { Category, ArticleDraft, ArticleDraftStatus } from "@/lib/types";
import type { Draft, DraftStatus } from "@/lib/ingest/drafts";
import { Tabs } from "@/components/admin-ui/Tabs";
import { DraftsClient } from "./DraftsClient";
import { ArticlesClient } from "./articles/ArticlesClient";

export function DraftsTabbed({
  newsDrafts,
  newsCounts,
  articleDrafts,
  articleCounts,
  categories,
}: {
  newsDrafts: Draft[];
  newsCounts: Record<DraftStatus, number>;
  articleDrafts: ArticleDraft[];
  articleCounts: Record<ArticleDraftStatus, number>;
  categories: Category[];
}) {
  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Drafts</h2>
          <div className="subtitle">
            Pending content from external news APIs and AI ideation, waiting to
            become live articles.
          </div>
        </div>
      </div>

      <Tabs
        storageKey="adm:drafts:tab"
        tabs={[
          {
            id: "news",
            label: "News drafts",
            hint: `${newsCounts.pending} pending`,
            content: (
              <DraftsClient drafts={newsDrafts} counts={newsCounts} />
            ),
          },
          {
            id: "articles",
            label: "Article drafts",
            hint: `${articleCounts.pending} pending`,
            content: (
              <ArticlesClient
                drafts={articleDrafts}
                counts={articleCounts}
                categories={categories}
              />
            ),
          },
        ]}
      />
    </>
  );
}
