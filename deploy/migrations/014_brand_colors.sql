-- 014_brand_colors.sql — primary/secondary brand colors editable from the
-- /admin/themes panel. Stored as hex strings; layout converts to CSS variables.

BEGIN;

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "PrimaryColor"   TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "SecondaryColor" TEXT;

COMMIT;
