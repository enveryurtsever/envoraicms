import { NextResponse } from "next/server";
import { getSettings } from "@/lib/queries/settings";
import { getHeaderCategories } from "@/lib/queries/categories";
import { getLatest } from "@/lib/queries/contents";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 1800;

export async function GET() {
  const settings = await getSettings();
  if (!settings.LlmsTxtEnabled) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [cats, latest] = await Promise.all([
    getHeaderCategories(),
    getLatest(50, 0),
  ]);

  const base = settings.SiteUrl.replace(/\/+$/, "");
  const lines: string[] = [];

  lines.push(`# ${settings.SiteName}`);
  lines.push("");
  lines.push(`> ${settings.Description}`);
  lines.push("");
  if (settings.LlmsTxtIntro) {
    lines.push(settings.LlmsTxtIntro.trim());
    lines.push("");
  }

  lines.push("## Sitemap");
  lines.push(`- [Sitemap XML](${absoluteUrl(base, "/sitemap.xml")})`);
  lines.push(`- [RSS](${absoluteUrl(base, "/rss.xml")})`);
  lines.push("");

  if (cats.length > 0) {
    lines.push("## Categories");
    for (const c of cats) {
      const desc = c.CatDesc ? ` — ${c.CatDesc.replace(/\s+/g, " ").trim()}` : "";
      lines.push(`- [${c.CatName}](${absoluteUrl(base, `/${c.CatSeo}`)})${desc}`);
    }
    lines.push("");
  }

  if (latest.length > 0) {
    lines.push("## Latest Articles");
    for (const a of latest) {
      lines.push(
        `- [${a.ContentTitle}](${absoluteUrl(base, `/${a.CatSeo}/${a.ContentSeo}`)})`,
      );
    }
    lines.push("");
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
