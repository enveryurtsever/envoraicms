import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { getCategoryBySlug } from "@/lib/queries/categories";
import { getContentBySlug, getRelated, getTrendingContentIds } from "@/lib/queries/contents";
import { getSettings } from "@/lib/queries/settings";
import { ArticleCard } from "@/components/ArticleCard";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { ViewBeacon } from "@/components/ViewBeacon";
import { breadcrumbJsonLd, contentMetadata, newsArticleJsonLd } from "@/lib/seo";
import { absoluteUrl, contentThumb, formatDate, formatDateLong, parseSource, toISO } from "@/lib/utils";

export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const items = await getTrendingContentIds();
  return items.map((i) => ({ category: i.CatSeo, slug: i.ContentSeo }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string; slug: string }> }
): Promise<Metadata> {
  const { category, slug } = await params;
  const [settings, content] = await Promise.all([getSettings(), getContentBySlug(slug)]);
  if (!content || content.CatSeo !== category) return { title: "Not found" };
  return contentMetadata(settings, content, category);
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const [settings, cat, content] = await Promise.all([
    getSettings(),
    getCategoryBySlug(category),
    getContentBySlug(slug),
  ]);
  if (!cat || !content || content.CatSeo !== category) notFound();

  const related = await getRelated(content.FK_CatID, content.ContentID, 4);
  const source = parseSource(content.ContentSource);
  const sanitized = content.ContentDetail
    ? DOMPurify.sanitize(content.ContentDetail, { USE_PROFILES: { html: true } })
    : "";
  const image = content.ContentImage || "/Upload/default-cover.jpg";
  const canonical = absoluteUrl(settings.SiteUrl, `/${cat.CatSeo}/${content.ContentSeo}`);

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500">
          <Link href="/" className="hover:text-brand">Home</Link>
          <span className="mx-2">›</span>
          <Link href={`/${cat.CatSeo}`} className="hover:text-brand">{cat.CatName}</Link>
        </nav>

        <header className="mb-5">
          <span className="inline-block rounded bg-brand/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand">
            {cat.CatName}
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-neutral-900 md:text-4xl">
            {content.ContentTitle}
          </h1>
          {content.ContentShort ? (
            <p className="mt-3 text-base leading-relaxed text-neutral-600 md:text-lg">
              {content.ContentShort}
            </p>
          ) : null}
          {content.AuthorName ? (
            <div className="mt-4 flex items-center gap-3">
              {content.AuthorAvatarURL ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={content.AuthorAvatarURL}
                  alt={content.AuthorName}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-neutral-200"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">
                  {content.AuthorName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                </span>
              )}
              <div className="min-w-0 text-xs leading-tight text-neutral-600">
                <div className="text-sm font-semibold text-neutral-900">
                  By {content.AuthorName}
                </div>
                {content.AuthorBio ? (
                  <div className="line-clamp-2 text-neutral-500">{content.AuthorBio}</div>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
            <time dateTime={toISO(content.PublishDate)}>
              {formatDateLong(content.PublishDate)}
            </time>
            {source?.href && source?.title ? (
              <>
                <span aria-hidden>•</span>
                <span>
                  Source:{" "}
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-brand hover:underline"
                  >
                    {source.title}
                  </a>
                </span>
              </>
            ) : null}
          </div>
        </header>

        <figure className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-200">
          <Image
            src={image}
            alt={content.ContentTitle}
            fill
            priority
            sizes="(min-width: 1024px) 860px, 100vw"
            className="object-cover"
          />
        </figure>

        <AdSlot name="in-article" className="my-6" />

        <div
          className="content-body"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />

        <AdSlot name="leaderboard-bottom" className="mt-8" />

        {settings.AdsEnabled && related.length > 0 ? (
          <section className="mt-12 border-t border-neutral-200 pt-8" aria-label="Related articles">
            <h2 className="mb-4 border-b-2 border-brand pb-2 text-lg font-bold uppercase tracking-wider text-brand">
              Related News
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <ArticleCard key={item.ContentID} item={item} variant="grid" sizes="(min-width: 1024px) 220px, 45vw" />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-4 flex flex-col gap-4">
          <AdSlot name="sidebar-half" />
          <AdSlot name="sidebar-mpu" />
          {!settings.AdsEnabled && related.length > 0 ? (
            <div>
              <h2 className="mb-3 border-b-2 border-brand pb-2 text-sm font-bold uppercase tracking-wider text-brand">
                Related News
              </h2>
              <ul className="divide-y divide-neutral-200">
                {related.map((item) => {
                  const href = `/${item.CatSeo}/${item.ContentSeo}`;
                  const img = contentThumb(item.ContentImage) || "/Upload/default-cover.jpg";
                  return (
                    <li key={item.ContentID}>
                      <Link href={href} className="group flex gap-3 py-3 first:pt-0">
                        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded bg-neutral-200">
                          <Image src={img} alt={item.ContentTitle} fill sizes="120px" className="object-cover" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-navy group-hover:text-brand">
                            {item.ContentTitle}
                          </h3>
                          {item.PublishDate ? (
                            <time className="mt-1 block text-[11px] text-neutral-500">{formatDate(item.PublishDate)}</time>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>

      <ViewBeacon contentId={content.ContentID} />
      <JsonLd data={newsArticleJsonLd(settings, content, cat.CatSeo)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: settings.SiteUrl },
          { name: cat.CatName, url: absoluteUrl(settings.SiteUrl, `/${cat.CatSeo}`) },
          { name: content.ContentTitle, url: canonical },
        ])}
      />
    </article>
  );
}
