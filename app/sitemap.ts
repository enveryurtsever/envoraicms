import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/queries/settings";
import { getHeaderCategories } from "@/lib/queries/categories";
import { countSitemapContents, getSitemapContents } from "@/lib/queries/contents";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;

const PAGE_SIZE = 5000;

export async function generateSitemaps(): Promise<{ id: number }[]> {
  const total = await countSitemapContents().catch(() => 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return Array.from({ length: pages }, (_, i) => ({ id: i }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const [settings, categories, contents] = await Promise.all([
    getSettings(),
    id === 0 ? getHeaderCategories() : Promise.resolve([]),
    getSitemapContents({ limit: PAGE_SIZE, offset: id * PAGE_SIZE }),
  ]);

  const base = settings.SiteUrl;
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];

  if (id === 0) {
    entries.push({ url: base, lastModified: now, changeFrequency: "hourly", priority: 1.0 });
    for (const c of categories) {
      entries.push({
        url: absoluteUrl(base, `/${c.CatSeo}`),
        lastModified: now,
        changeFrequency: "hourly",
        priority: 0.8,
      });
    }
  }

  for (const c of contents) {
    const url = absoluteUrl(base, `/${c.CatSeo}/${c.ContentSeo}`);
    const lastMod = new Date(c.ModifiedDate ?? c.PublishDate);
    const entry: MetadataRoute.Sitemap[number] = {
      url,
      lastModified: lastMod,
      changeFrequency: "weekly",
      priority: 0.6,
    };
    if (c.ContentImage) {
      entry.images = [absoluteUrl(base, c.ContentImage)];
    }
    entries.push(entry);
  }

  return entries;
}
