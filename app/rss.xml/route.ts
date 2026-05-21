import { getSettings } from "@/lib/queries/settings";
import { getLatest } from "@/lib/queries/contents";
import { absoluteUrl, toISO, truncate } from "@/lib/utils";

// Dynamic, not ISR: prerendering this at build time opens DB connections that
// keep the `next build` process alive (idle sockets) and stall the in-app
// updater. Rendered per-request; underlying queries are cached via
// unstable_cache, so it stays cheap and reflects live content.
export const dynamic = "force-dynamic";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [settings, items] = await Promise.all([getSettings(), getLatest(50)]);
  const base = settings.SiteUrl;

  const entries = items
    .map((item) => {
      const url = absoluteUrl(base, `/${item.CatSeo}/${item.ContentSeo}`);
      const title = xmlEscape(item.ContentTitle);
      const desc = xmlEscape(truncate(item.ContentDesc ?? item.ContentShort ?? "", 300));
      const pub = new Date(item.PublishDate).toUTCString();
      return `    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <category>${xmlEscape(item.CatName)}</category>
      <description>${desc}</description>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(settings.SiteName)}</title>
    <link>${base}</link>
    <description>${xmlEscape(settings.Description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${absoluteUrl(base, "/rss.xml")}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
