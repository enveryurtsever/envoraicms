-- 015_site_language.sql — single source of truth for the public site's
-- language. Drives <html lang>, JSON-LD inLanguage, OpenGraph locale, and
-- the Google News sitemap `<news:language>` tag.

BEGIN;

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "SiteLanguage" TEXT DEFAULT 'en';

COMMIT;
