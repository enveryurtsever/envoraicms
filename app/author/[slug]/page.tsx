import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { JsonLd } from "@/components/JsonLd";
import { getAuthorBySlug } from "@/lib/queries/authors";
import { listByAuthorId, countByAuthorId } from "@/lib/queries/contents";
import { getSettings } from "@/lib/queries/settings";
import { authorJsonLd, authorMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";

// Dynamic: the root layout reads request headers/cookies, so a static
// prerender here throws DYNAMIC_SERVER_USAGE. DB reads remain cached via
// unstable_cache in lib/queries.
export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const [settings, author] = await Promise.all([getSettings(), getAuthorBySlug(slug)]);
  if (!author) return { title: "Author not found" };
  return authorMetadata(settings, author);
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [settings, author] = await Promise.all([getSettings(), getAuthorBySlug(slug)]);
  if (!author) notFound();

  const [items, total] = await Promise.all([
    listByAuthorId(author.AuthorID, { limit: 24 }),
    countByAuthorId(author.AuthorID),
  ]);

  const canonical = absoluteUrl(settings.SiteUrl, `/author/${author.Slug}`);

  return (
    <>
      <header className="mb-8 border-b border-neutral-200 pb-6 dark:border-neutral-700">
        <nav aria-label="Breadcrumb" className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          <Link href="/" className="hover:text-brand">Home</Link>
          <span className="mx-2">›</span>
          <span className="text-neutral-700 dark:text-neutral-300">Authors</span>
        </nav>
        <div className="flex items-start gap-4 sm:gap-5">
          {author.AvatarURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={author.AvatarURL}
              alt={author.DisplayName}
              width={88}
              height={88}
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700 sm:h-20 sm:w-20 md:h-24 md:w-24"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-base font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 sm:h-20 sm:w-20 sm:text-lg md:h-24 md:w-24 md:text-xl">
              {author.DisplayName
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl md:text-3xl dark:text-neutral-100">
              {author.DisplayName}
            </h1>
            {author.Bio ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 md:text-base dark:text-neutral-400">
                {author.Bio}
              </p>
            ) : null}
            <p className="mt-3 text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {total} {total === 1 ? "story" : "stories"}
            </p>
          </div>
        </div>
      </header>

      {items.length > 0 ? (
        <section
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-label={`Stories by ${author.DisplayName}`}
        >
          {items.map((item) => (
            <ArticleCard
              key={item.ContentID}
              item={item}
              variant="grid"
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw"
            />
          ))}
        </section>
      ) : (
        <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
          No stories yet by {author.DisplayName}.
        </p>
      )}

      <JsonLd data={authorJsonLd(settings, author)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: settings.SiteUrl },
          { name: author.DisplayName, url: canonical },
        ])}
      />
    </>
  );
}
