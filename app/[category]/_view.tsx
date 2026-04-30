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

export const PAGE_SIZE = 16;

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
  const [lead, ...rest] = items;

  const pageHref = (n: number) => (n === 1 ? `/${slug}` : `/${slug}/page/${n}`);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-neutral-800">{cat.CatName}</span>
      </nav>

      <header className="mb-6 border-b border-neutral-200 pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wide text-neutral-900 md:text-3xl">
          {cat.CatTitle}
        </h1>
        {cat.CatDesc ? (
          <p className="mt-2 text-sm text-neutral-600 md:text-base">{cat.CatDesc}</p>
        ) : null}
      </header>

      <AdSlot name="leaderboard-top" className="mb-6" />

      {lead ? (
        <section className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <ArticleCard item={lead} variant="hero" priority sizes="(min-width: 1024px) 860px, 100vw" />
          <aside className="hidden lg:flex">
            {settings.AdsEnabled ? (
              <AdSlot name="sidebar-half" className="h-full w-full" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
                <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
                  Advertise
                </span>
                <h3 className="mt-2 text-lg font-bold text-neutral-900">
                  Your Ad Could Be Here
                </h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Reach thousands of readers every day. Promote your brand in this premium spot.
                </p>
                <a
                  href="mailto:ads@envoraicms.com?subject=Advertising%20Inquiry"
                  className="mt-4 inline-flex items-center rounded bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-brand/90"
                >
                  Contact Us
                </a>
              </div>
            )}
          </aside>
        </section>
      ) : null}

      <section aria-label={`${cat.CatName} articles`} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((item) => (
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
              className="rounded border border-neutral-300 px-3 py-2 hover:border-brand hover:text-brand"
            >
              ← Previous
            </Link>
          ) : null}
          <span className="px-3 py-2 text-neutral-600">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded border border-neutral-300 px-3 py-2 hover:border-brand hover:text-brand"
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
