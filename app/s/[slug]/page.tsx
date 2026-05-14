import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { getLinkBySlug } from "@/lib/queries/links";
import { getSettings } from "@/lib/queries/settings";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const [settings, link] = await Promise.all([getSettings(), getLinkBySlug(slug)]);
  if (!link) return { title: "Not found" };
  const url = absoluteUrl(settings.SiteUrl, `/s/${slug}`);
  return {
    title: `${link.LinkTitle} — ${settings.SiteName}`,
    alternates: { canonical: url },
    openGraph: {
      title: link.LinkTitle,
      url,
      siteName: settings.SiteName,
      type: "article",
    },
  };
}

export default async function StaticPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [settings, link] = await Promise.all([getSettings(), getLinkBySlug(slug)]);
  if (!link || !link.LinkSeo) notFound();

  const sanitized = link.LinkContent
    ? DOMPurify.sanitize(link.LinkContent, { USE_PROFILES: { html: true } })
    : "";

  return (
    <article className="mx-auto w-full max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-neutral-800 dark:text-neutral-200">{link.LinkTitle}</span>
      </nav>

      <header className="mb-6 border-b border-neutral-200 pb-4 dark:border-neutral-700">
        <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-100">{link.LinkTitle}</h1>
      </header>

      {sanitized ? (
        <div
          className="content-body"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      ) : (
        <p className="text-neutral-600 dark:text-neutral-400">This page has no content yet.</p>
      )}

      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: settings.SiteUrl },
          { name: link.LinkTitle, url: absoluteUrl(settings.SiteUrl, `/s/${slug}`) },
        ])}
      />
    </article>
  );
}
