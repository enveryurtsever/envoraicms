-- Site-wide menu visibility toggles. When OFF, the corresponding region is
-- hidden across the public site (regardless of per-category flags).

BEGIN;

ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "ShowHeaderMenu" BOOLEAN DEFAULT TRUE;

ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "ShowFooterMenu" BOOLEAN DEFAULT TRUE;

COMMIT;
