import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/queries/settings";
import { absoluteUrl } from "@/lib/utils";

// Dynamic, not ISR: prerendering this at build time opens a DB connection
// (getSettings) that keeps the `next build` process alive and stalls the
// in-app updater. Rendered per-request; getSettings is cached via
// unstable_cache.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/install", "/api/", "/search"],
      },
    ],
    sitemap: absoluteUrl(settings.SiteUrl, "/sitemap.xml"),
    host: settings.SiteUrl,
  };
}
