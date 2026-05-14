import { getSettings } from "@/lib/queries/settings";
import { getHeaderCategories } from "@/lib/queries/categories";
import { getSitemapContents } from "@/lib/queries/contents";
import { absoluteUrl, toISO } from "@/lib/utils";
import { newsLanguage } from "@/lib/site-language";

// Single unified sitemap. Holds homepage + categories + all article URLs with
// image and news markup in one file (50k URLs / 50MB Sitemaps protocol cap is
// well above the site's foreseeable scale). The custom XML route exists so we
// can emit the `image:` and `news:` namespaces, which the built-in
// MetadataRoute.Sitemap helper does not support.
export const revalidate = 3600;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Google News only ingests entries published within the last 48 hours.
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function GET() {
  const [settings, categories, contents] = await Promise.all([
    getSettings(),
    getHeaderCategories(),
    getSitemapContents({ limit: 50_000, offset: 0 }),
  ]);

  const base = settings.SiteUrl;
  const publication = xmlEscape(settings.SiteName);
  const lang = newsLanguage(settings.SiteLanguage);
  const now = new Date();
  const newsCutoff = now.getTime() - NEWS_WINDOW_MS;

  const parts: string[] = [];

  parts.push(
    `  <url>
    <loc>${xmlEscape(base)}</loc>
    <lastmod>${toISO(now)}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>`,
  );

  for (const c of categories) {
    parts.push(
      `  <url>
    <loc>${xmlEscape(absoluteUrl(base, `/${c.CatSeo}`))}</loc>
    <lastmod>${toISO(now)}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>`,
    );
  }

  for (const c of contents) {
    const url = absoluteUrl(base, `/${c.CatSeo}/${c.ContentSeo}`);
    const lastMod = new Date(c.ModifiedDate ?? c.PublishDate);
    const publishedAt = new Date(c.PublishDate);
    const isNews = publishedAt.getTime() >= newsCutoff;

    const imageBlock = c.ContentImage
      ? `    <image:image>
      <image:loc>${xmlEscape(absoluteUrl(base, c.ContentImage))}</image:loc>
      <image:title>${xmlEscape(c.ContentTitle)}</image:title>
    </image:image>\n`
      : "";

    const newsBlock = isNews
      ? `    <news:news>
      <news:publication>
        <news:name>${publication}</news:name>
        <news:language>${lang}</news:language>
      </news:publication>
      <news:publication_date>${toISO(publishedAt)}</news:publication_date>
      <news:title>${xmlEscape(c.ContentTitle)}</news:title>
    </news:news>\n`
      : "";

    parts.push(
      `  <url>
    <loc>${xmlEscape(url)}</loc>
    <lastmod>${toISO(lastMod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
${imageBlock}${newsBlock}  </url>`,
    );
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${parts.join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
