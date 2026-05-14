import type { Metadata } from "next";
import Image from "next/image";
import { SafeImage } from "@/components/SafeImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { getCategoryBySlug } from "@/lib/queries/categories";
import { getContentBySlug, getPopular, getRelated, getTrendingContentIds } from "@/lib/queries/contents";
import { getSettings } from "@/lib/queries/settings";
import { ArticleCard } from "@/components/ArticleCard";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { ViewBeacon } from "@/components/ViewBeacon";
import { SocialShare } from "@/components/SocialShare";
import { breadcrumbJsonLd, contentMetadata, newsArticleJsonLd } from "@/lib/seo";
import { absoluteUrl, contentThumb, formatCount, formatDate, formatDateLong, parseSource, toISO, toSearchSlug } from "@/lib/utils";

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

function readingMinutes(html: string | null | undefined): number {
  if (!html) return 1;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 220));
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

  const [related, popularRaw] = await Promise.all([
    getRelated(content.FK_CatID, content.ContentID, 4),
    getPopular(7, 7),
  ]);
  const popular = popularRaw.filter((p) => p.ContentID !== content.ContentID).slice(0, 6);
  const source = parseSource(content.ContentSource);
  const sanitized = content.ContentDetail
    ? DOMPurify.sanitize(content.ContentDetail, { USE_PROFILES: { html: true } })
    : "";
  const image = content.ContentImage || settings.CoverImage || "/Upload/default-cover.jpg";
  const canonical = absoluteUrl(settings.SiteUrl, `/${cat.CatSeo}/${content.ContentSeo}`);
  const minutes = readingMinutes(content.ContentDetail);
  const tags = (content.ContentKeywords ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  const publishedAt = new Date(content.PublishDate).getTime();
  const modifiedAt = content.ModifiedDate ? new Date(content.ModifiedDate).getTime() : publishedAt;
  // Only surface "Updated" when the modification is materially after publish —
  // the ingest pipeline writes both fields together, so a small delta is noise.
  const wasUpdated = modifiedAt - publishedAt > 6 * 60 * 60 * 1000;
  const authorHref = content.AuthorSlug ? `/author/${content.AuthorSlug}` : null;

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          <Link href="/" className="hover:text-brand">Home</Link>
          <span className="mx-2">›</span>
          <Link href={`/${cat.CatSeo}`} className="hover:text-brand">{cat.CatName}</Link>
        </nav>

        <header className="mb-5">
          <span className="inline-block rounded bg-brand/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand dark:bg-brand/20">
            {cat.CatName}
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-neutral-900 md:text-4xl dark:text-neutral-50">
            {content.ContentTitle}
          </h1>
          {content.ContentShort ? (
            <p className="mt-3 text-base leading-relaxed text-neutral-600 md:text-lg dark:text-neutral-300">
              {content.ContentShort}
            </p>
          ) : null}
          {content.AuthorName ? (
            <div className="mt-4 flex items-center gap-3">
              {content.AuthorAvatarURL ? (
                <Image
                  src={content.AuthorAvatarURL}
                  alt={content.AuthorName}
                  width={40}
                  height={40}
                  sizes="40px"
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {content.AuthorName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                </span>
              )}
              <div className="min-w-0 text-xs leading-tight text-neutral-600 dark:text-neutral-400">
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  By{" "}
                  {authorHref ? (
                    <Link
                      href={authorHref}
                      className="text-neutral-900 hover:text-brand hover:underline dark:text-neutral-100"
                      rel="author"
                    >
                      {content.AuthorName}
                    </Link>
                  ) : (
                    content.AuthorName
                  )}
                </div>
                {content.AuthorBio ? (
                  <div className="line-clamp-2 text-neutral-500 dark:text-neutral-400">{content.AuthorBio}</div>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <time dateTime={toISO(content.PublishDate)}>
              {formatDateLong(content.PublishDate)}
            </time>
            {wasUpdated && content.ModifiedDate ? (
              <>
                <span aria-hidden>•</span>
                <span className="text-neutral-600 dark:text-neutral-300">
                  Updated{" "}
                  <time dateTime={toISO(content.ModifiedDate)}>
                    {formatDateLong(content.ModifiedDate)}
                  </time>
                </span>
              </>
            ) : null}
            <span aria-hidden>•</span>
            <span>{minutes} min read</span>
            {settings.ShowViewCounts ? (
              <>
                <span aria-hidden>•</span>
                <span
                  aria-label={`${content.ViewCount ?? 0} views`}
                  className="inline-flex items-center gap-1"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {formatCount(content.ViewCount)} views
                </span>
              </>
            ) : null}
          </div>
        </header>

        <figure className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-200">
          <SafeImage
            src={image}
            alt={content.ContentTitle}
            fill
            priority
            sizes="(min-width: 1024px) 860px, 100vw"
            className="object-cover"
          />
        </figure>

        <SocialShare
          url={canonical}
          title={content.ContentTitle}
          via={settings.TwitterHandle}
          className="mb-6"
        />

        <AdSlot name="in-article" className="my-6" />

        <div
          className="content-body"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />

        {source?.href && source?.title ? (
          <div className="mt-8 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-neutral-200 pt-5 dark:border-neutral-700">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Source
            </span>
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-sm text-brand hover:underline"
            >
              {source.title}
            </a>
          </div>
        ) : null}

        {tags.length > 0 ? (
          <div
            className="mt-8 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-5 dark:border-neutral-700"
            aria-label="Topics"
          >
            <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Topics
            </span>
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/search/${toSearchSlug(tag)}`}
                className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700 transition hover:border-brand hover:text-brand dark:border-neutral-700 dark:text-neutral-300"
              >
                {tag}
              </Link>
            ))}
          </div>
        ) : null}

        <SocialShare
          url={canonical}
          title={content.ContentTitle}
          via={settings.TwitterHandle}
          className="mt-6"
        />

        {content.AuthorName ? (
          <aside
            className="mt-8 flex gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-900"
            aria-label="About the author"
          >
            {content.AuthorAvatarURL ? (
              <Image
                src={content.AuthorAvatarURL}
                alt={content.AuthorName}
                width={56}
                height={56}
                sizes="56px"
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {content.AuthorName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
              </span>
            )}
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Written by
              </div>
              <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {authorHref ? (
                  <Link href={authorHref} className="hover:text-brand hover:underline">
                    {content.AuthorName}
                  </Link>
                ) : (
                  content.AuthorName
                )}
              </div>
              {content.AuthorBio ? (
                <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {content.AuthorBio}
                </p>
              ) : null}
              {authorHref ? (
                <Link
                  href={authorHref}
                  className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
                >
                  More stories by {content.AuthorName.split(" ")[0]} →
                </Link>
              ) : null}
            </div>
          </aside>
        ) : null}

        <AdSlot name="leaderboard-bottom" className="mt-8" />

        {settings.AdsEnabled && related.length > 0 ? (
          <section className="mt-12 border-t border-neutral-200 pt-8 dark:border-neutral-700" aria-label="Related articles">
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
        <div className="sticky top-4 flex flex-col gap-6">
          <AdSlot name="sidebar-half" />

          {popular.length > 0 ? (
            <div>
              <h2 className="mb-3 border-b-2 border-brand pb-2 text-sm font-bold uppercase tracking-wider text-brand">
                Popular This Week
              </h2>
              <ol className="space-y-3">
                {popular.map((item, idx) => {
                  const href = `/${item.CatSeo}/${item.ContentSeo}`;
                  return (
                    <li key={item.ContentID}>
                      <Link href={href} className="group flex gap-3">
                        <span
                          aria-hidden
                          className="shrink-0 text-2xl font-black leading-none text-brand/70"
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-3 text-[13px] font-semibold leading-snug text-navy group-hover:text-brand dark:text-neutral-100">
                            {item.ContentTitle}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            <span>{item.CatName}</span>
                            {settings.ShowViewCounts && (item.ViewCount ?? 0) > 0 ? (
                              <>
                                <span aria-hidden>•</span>
                                <span aria-label={`${item.ViewCount} views`}>
                                  {formatCount(item.ViewCount)} views
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          <AdSlot name="sidebar-mpu" />

          {!settings.AdsEnabled && related.length > 0 ? (
            <div>
              <h2 className="mb-3 border-b-2 border-brand pb-2 text-sm font-bold uppercase tracking-wider text-brand">
                Related News
              </h2>
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {related.map((item) => {
                  const href = `/${item.CatSeo}/${item.ContentSeo}`;
                  const img = contentThumb(item.ContentImage) || settings.CoverImage || "/Upload/default-cover.jpg";
                  return (
                    <li key={item.ContentID}>
                      <Link href={href} className="group flex gap-3 py-3 first:pt-0">
                        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded bg-neutral-200">
                          <SafeImage src={img} alt={item.ContentTitle} fill sizes="120px" className="object-cover" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-navy group-hover:text-brand dark:text-neutral-100">
                            {item.ContentTitle}
                          </h3>
                          {item.PublishDate ? (
                            <time className="mt-1 block text-[11px] text-neutral-500 dark:text-neutral-400">{formatDate(item.PublishDate)}</time>
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
