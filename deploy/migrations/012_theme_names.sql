-- Theme labels were generic ("Classic", "Magazine", "Minimal") and did not
-- describe the actual layout. Rename + rewrite descriptions so the admin
-- /admin/themes panel matches what each template renders.

BEGIN;

UPDATE "Themes"
   SET "ThemeName" = 'Editorial Grid',
       "ThemeDesc" = 'Hero carousel up top, then category duos, hot-now strip, and tall-feature columns.'
 WHERE "ThemeSlug" = 'classic';

UPDATE "Themes"
   SET "ThemeName" = 'Cover Mosaic',
       "ThemeDesc" = 'Three-column overlay mosaic with a dominant cover; image-driven feel.'
 WHERE "ThemeSlug" = 'magazine';

UPDATE "Themes"
   SET "ThemeName" = 'Broadsheet',
       "ThemeDesc" = 'Top headline strip, big lead with sidebar list, then dense category columns.'
 WHERE "ThemeSlug" = 'minimal';

COMMIT;
