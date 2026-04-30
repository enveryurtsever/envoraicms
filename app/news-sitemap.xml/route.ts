import { getSettings } from "@/lib/queries/settings";
import { getNewsSitemapContents } from "@/lib/queries/contents";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 600;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [settings, items] = await Promise.all([getSettings(), getNewsSitemapContents()]);
  const base = settings.SiteUrl;
  const publication = xmlEscape(settings.SiteName);

  const entries = items
    .map((item) => {
      const url = absoluteUrl(base, `/${item.CatSeo}/${item.ContentSeo}`);
      const pubDate = new Date(item.PublishDate).toISOString();
      const title = xmlEscape(item.ContentTitle);
      const imageBlock = item.ContentImage
        ? `      <image:image>
        <image:loc>${xmlEscape(absoluteUrl(base, item.ContentImage))}</image:loc>
        <image:title>${title}</image:title>
      </image:image>\n`
        : "";
      return `    <url>
      <loc>${url}</loc>
${imageBlock}      <news:news>
        <news:publication>
          <news:name>${publication}</news:name>
          <news:language>tr</news:language>
        </news:publication>
        <news:publication_date>${pubDate}</news:publication_date>
        <news:title>${title}</news:title>
      </news:news>
    </url>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
