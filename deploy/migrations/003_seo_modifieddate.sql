-- 003_seo_modifieddate.sql — Contents.ModifiedDate (Google için dateModified sinyali)
-- Append-only; mevcut satırlar için PublishDate fallback olarak kullanılır.

BEGIN;

ALTER TABLE "Contents" ADD COLUMN IF NOT EXISTS "ModifiedDate" TIMESTAMP;

-- Eski satırları PublishDate ile doldur (NULL kalmasın → sitemap/JSON-LD tutarlı).
UPDATE "Contents" SET "ModifiedDate" = "PublishDate" WHERE "ModifiedDate" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_contents_modified" ON "Contents" ("ModifiedDate" DESC)
  WHERE "IsActive" = TRUE AND "IsDeleted" = FALSE;

COMMIT;
