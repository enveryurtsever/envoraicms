import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/queries/settings";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;

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
