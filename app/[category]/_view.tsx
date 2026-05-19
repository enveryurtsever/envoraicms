import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategoryBySlug } from "@/lib/queries/categories";
import { countByCategoryId, listByCategoryId } from "@/lib/queries/contents";
import { getSettings } from "@/lib/queries/settings";
import { ArticleCard } from "@/components/ArticleCard";
import { JsonLd } from "@/components/JsonLd";
import { AdSlot } from "@/components/AdSlot";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";

export const PAGE_SIZE = 18;

export async function CategoryView({ slug, page }: { slug: string; page: number }) {
  const offset = (page - 1) * PAGE_SIZE;
  const [settings, cat] = await Promise.all([getSettings(), getCategoryBySlug(slug)]);
  if (!cat) notFound();

  const [items, total] = await Promise.all([
    listByCategoryId(cat.CatID, { limit: PAGE_SIZE, offset }),
    countByCategoryId(cat.CatID),
  ]);

  if (page > 1 && items.length === 0) notFound();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Layout split:
  //   - items[0]       — hero (full-width on the left of the top row)
  //   - asideItems     — two cards stacked next to the hero when ads are off;
  //                      when AdsEnabled, the ad slot takes this spot and the
  //                      same items spill back into the grid below
  //   - gridItems      — everything else, rendered as the 3-up grid
  const [lead, ...rest] = items;
  const asideItems = settings.AdsEnabled ? [] : rest.slice(0, 2);
  const gridItems = settings.AdsEnabled ? rest : rest.slice(2);

  const pageHref = (n: number) => (n === 1 ? `/${slug}` : `/${slug}/page/${n}`);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-neutral-800 dark:text-neutral-200">{cat.CatName}</span>
      </nav>

      <header className="mb-6 border-b border-neutral-200 pb-4 dark:border-neutral-700">
        <h1 className="text-2xl font-bold uppercase tracking-wide text-neutral-900 md:text-3xl dark:text-neutral-100">
          {cat.CatTitle}
        </h1>
        {cat.CatDesc ? (
          <p className="mt-2 text-sm text-neutral-600 md:text-base dark:text-neutral-400">{cat.CatDesc}</p>
        ) : null}
      </header>

      <AdSlot name="leaderboard-top" className="mb-6" />

      {lead ? (
        <section className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <ArticleCard item={lead} variant="hero" priority sizes="(min-width: 1024px) 860px, 100vw" />
          <aside className="hidden lg:block">
            {settings.AdsEnabled ? (
              <AdSlot name="sidebar-half" className="h-full w-full" />
            ) : (
              <div className="flex h-full flex-col gap-4">
                {asideItems.map((item) => (
                  <ArticleCard
                    key={item.ContentID}
                    item={item}
                    variant="grid"
                    sizes="300px"
                  />
                ))}
              </div>
            )}
          </aside>
        </section>
      ) : null}

      <section aria-label={`${cat.CatName} articles`} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {gridItems.map((item) => (
          <ArticleCard
            key={item.ContentID}
            item={item}
            variant="grid"
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw"
          />
        ))}
      </section>

      <AdSlot name="leaderboard-bottom" className="mt-10" />

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded border border-neutral-300 px-3 py-2 hover:border-brand hover:text-brand dark:border-neutral-700 dark:text-neutral-300"
            >
              ← Previous
            </Link>
          ) : null}
          <span className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded border border-neutral-300 px-3 py-2 hover:border-brand hover:text-brand dark:border-neutral-700 dark:text-neutral-300"
            >
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}

      <JsonLd data={collectionPageJsonLd(settings, cat)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: settings.SiteUrl },
          { name: cat.CatName, url: absoluteUrl(settings.SiteUrl, `/${cat.CatSeo}`) },
        ])}
      />
    </>
  );
}
