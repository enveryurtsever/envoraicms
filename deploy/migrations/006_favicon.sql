-- Settings.Favicon: small square site icon used by browser tabs and PWA tags.
-- Optional; layout falls back to /favicon.ico when empty.

BEGIN;

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "Favicon" TEXT;

COMMIT;
