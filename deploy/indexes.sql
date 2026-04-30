-- Run as user_envoraicms after pg_restore completes.
-- Indexes optimised for phase-1 read paths (homepage, category, detail slug, search).

CREATE INDEX IF NOT EXISTS idx_contents_seo
  ON "Contents" ("ContentSeo")
  WHERE "IsActive" AND NOT "IsDeleted";

CREATE INDEX IF NOT EXISTS idx_contents_cat_date
  ON "Contents" ("FK_CatID", "PublishDate" DESC)
  WHERE "IsActive" AND NOT "IsDeleted";

CREATE INDEX IF NOT EXISTS idx_contents_homepage
  ON "Contents" ("PublishDate" DESC)
  WHERE "IsActive" AND NOT "IsDeleted" AND "Homepage";

CREATE INDEX IF NOT EXISTS idx_contents_publish
  ON "Contents" ("PublishDate" DESC)
  WHERE "IsActive" AND NOT "IsDeleted";

CREATE INDEX IF NOT EXISTS idx_categories_seo
  ON "Categories" ("CatSeo")
  WHERE "IsActive" AND NOT "IsDeleted";

-- Full-text search (used only if we switch from ILIKE):
CREATE INDEX IF NOT EXISTS idx_contents_fts
  ON "Contents" USING gin (
    to_tsvector('english',
      coalesce("ContentTitle",'') || ' ' ||
      coalesce("ContentDesc",'') || ' ' ||
      coalesce("ContentKeywords",'')
    )
  );

ANALYZE "Contents";
ANALYZE "Categories";
ANALYZE "Settings";
