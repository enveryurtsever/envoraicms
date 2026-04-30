import type { Metadata } from "next";
import type { Settings, Category, Content } from "@/lib/types";
import { absoluteUrl, truncate, toISO } from "@/lib/utils";

export function siteMetadata(s: Settings): Metadata {
  return {
    metadataBase: new URL(s.SiteUrl),
    title: { default: s.Title, template: `%s | ${s.SiteName}` },
    description: s.Description,
    keywords: s.Keywords?.split(",").map((k) => k.trim()).filter(Boolean),
    applicationName: s.SiteName,
    icons: {
      icon: [
        { url: "/Upload/favicon/favicon.ico" },
        { url: "/Upload/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
        { url: "/Upload/favicon/favicon.svg", type: "image/svg+xml" },
      ],
      apple: "/Upload/favicon/apple-touch-icon.png",
    },
    manifest: "/Upload/favicon/site.webmanifest",
    openGraph: {
      type: "website",
      siteName: s.SiteName,
      title: s.Title,
      description: s.Description,
      url: s.SiteUrl,
      images: s.CoverImage ? [{ url: s.CoverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: s.Title,
      description: s.Description,
      images: s.CoverImage ? [s.CoverImage] : undefined,
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    alternates: { canonical: s.SiteUrl },
  };
}

export function categoryMetadata(s: Settings, c: Category): Metadata {
  const url = absoluteUrl(s.SiteUrl, `/${c.CatSeo}`);
  return {
    title: c.CatTitle,
    description: c.CatDesc ?? s.Description,
    keywords: c.CatKeywords?.split(",").map((k) => k.trim()).filter(Boolean),
    alternates: { canonical: url, types: { "application/rss+xml": `${url}/rss.xml` } },
    openGraph: {
      type: "website",
      siteName: s.SiteName,
      title: c.CatTitle,
      description: c.CatDesc ?? s.Description,
      url,
      images: c.CatImage ? [{ url: c.CatImage }] : s.CoverImage ? [{ url: s.CoverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: c.CatTitle,
      description: c.CatDesc ?? s.Description,
    },
  };
}

export function contentMetadata(s: Settings, c: Content, categorySeo: string): Metadata {
  const url = absoluteUrl(s.SiteUrl, `/${categorySeo}/${c.ContentSeo}`);
  const img = c.ContentImage ? absoluteUrl(s.SiteUrl, c.ContentImage) : s.CoverImage ?? undefined;
  const desc = truncate(c.ContentDesc ?? c.ContentShort ?? s.Description, 200);
  return {
    title: c.ContentTitle,
    description: desc,
    keywords: c.ContentKeywords?.split(",").map((k) => k.trim()).filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: s.SiteName,
      title: c.ContentTitle,
      description: desc,
      url,
      images: img ? [{ url: img }] : undefined,
      publishedTime: toISO(c.PublishDate),
      section: c.CatName,
      tags: c.ContentKeywords?.split(",").map((t) => t.trim()).filter(Boolean),
    },
    twitter: {
      card: "summary_large_image",
      title: c.ContentTitle,
      description: desc,
      images: img ? [img] : undefined,
    },
  };
}

export function newsArticleJsonLd(s: Settings, c: Content, categorySeo: string) {
  const url = absoluteUrl(s.SiteUrl, `/${categorySeo}/${c.ContentSeo}`);
  const img = c.ContentImage ? absoluteUrl(s.SiteUrl, c.ContentImage) : s.CoverImage ?? undefined;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: c.ContentTitle,
    description: truncate(c.ContentDesc ?? c.ContentShort ?? "", 200),
    image: img ? [img] : undefined,
    datePublished: toISO(c.PublishDate),
    dateModified: toISO(c.ModifiedDate ?? c.PublishDate),
    articleSection: c.CatName,
    keywords: c.ContentKeywords ?? undefined,
    author: { "@type": "Organization", name: s.SiteName, url: s.SiteUrl },
    publisher: {
      "@type": "Organization",
      name: s.SiteName,
      logo: s.SiteLogo
        ? { "@type": "ImageObject", url: absoluteUrl(s.SiteUrl, s.SiteLogo) }
        : undefined,
    },
  };
}

export function websiteJsonLd(s: Settings) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: s.SiteName,
    url: s.SiteUrl,
    description: s.Description,
    potentialAction: {
      "@type": "SearchAction",
      target: `${(s.SiteUrl ?? "").replace(/\/$/, "")}/search/{search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd(s: Settings) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.SiteName,
    url: s.SiteUrl,
    logo: s.SiteLogo ? absoluteUrl(s.SiteUrl, s.SiteLogo) : undefined,
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function collectionPageJsonLd(s: Settings, c: Category) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.CatTitle,
    description: c.CatDesc ?? s.Description,
    url: absoluteUrl(s.SiteUrl, `/${c.CatSeo}`),
    isPartOf: { "@type": "WebSite", name: s.SiteName, url: s.SiteUrl },
  };
}
