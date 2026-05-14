-- 013_perf_indexes.sql — performance indexes for popular sort, draft recency,
-- and admin ILIKE search. Idempotent; safe to re-run.

-- Popular this-week / sidebar query: ORDER BY ViewCount DESC, PublishDate DESC.
-- No existing index covers ViewCount sort.
CREATE INDEX IF NOT EXISTS "idx_contents_viewcount"
  ON "Contents" ("ViewCount" DESC NULLS LAST, "PublishDate" DESC)
  WHERE "IsActive" AND NOT "IsDeleted";

-- recentTitlesForCategoryMap UNION on the ArticleDrafts side orders by
-- CreatedAt DESC per category. Existing idx_articledrafts_cat is (CatID, Status)
-- without time, so the planner falls back to sort.
CREATE INDEX IF NOT EXISTS "idx_articledrafts_cat_created"
  ON "ArticleDrafts" ("FK_CatID", "CreatedAt" DESC);

-- Same query orders the Contents side by CreatedDate (not PublishDate, which
-- the existing idx_contents_cat_date already covers).
CREATE INDEX IF NOT EXISTS "idx_contents_cat_created"
  ON "Contents" ("FK_CatID", "CreatedDate" DESC)
  WHERE NOT "IsDeleted";

-- Admin contents search uses ILIKE on ContentTitle. Trigram index makes
-- substring search index-driven instead of full table scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "idx_contents_title_trgm"
  ON "Contents" USING gin ("ContentTitle" gin_trgm_ops)
  WHERE "IsActive" AND NOT "IsDeleted";

ANALYZE "Contents";
ANALYZE "ArticleDrafts";
