import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { searchContents } from "@/lib/queries/contents";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Search",
  description: "Search breaking news across all categories.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  params,
}: {
  params: Promise<{ query: string }>;
}) {
  const { query: raw } = await params;
  const query = decodeURIComponent(raw).trim().slice(0, 100);

  if (query.length < 4) redirect("/");

  const results = await searchContents(query, { limit: 48 });
  // /search/ URLs are hyphenated slugs ("aging-research"); show the spaced
  // form ("aging research") in the heading so it reads naturally.
  const display = query.includes("-") && !query.includes(" ")
    ? query.replace(/-/g, " ")
    : query;

  return (
    <>
      <header className="mb-6 border-b border-neutral-200 pb-4 dark:border-neutral-700">
        <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-100">
          Search <span className="text-brand">“{display}”</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {`${results.length} result${results.length === 1 ? "" : "s"}`}
        </p>
      </header>

      {results.length > 0 ? (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <ArticleCard key={item.ContentID} item={item} variant="grid" sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw" />
          ))}
        </section>
      ) : (
        <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
          No results. Try a different keyword.
        </p>
      )}
    </>
  );
}
