import type { Metadata } from "next";
import type { Settings, Category, Content, Author } from "@/lib/types";
import { absoluteUrl, parseSource, truncate, toISO } from "@/lib/utils";
import { htmlLang, ogLocale } from "@/lib/site-language";

export function siteMetadata(s: Settings): Metadata {
  // Favicon resolution order:
  //   1. Settings.Favicon — what the admin uploaded (path under /Upload).
  //   2. /Upload/favicon/* — legacy static set, used if the operator dropped
  //      pre-built variants in there manually (no DB row required).
  //   3. Otherwise we leave it unset and let the browser use the default.
  const uploaded = s.Favicon?.trim() || null;
  const icons: Metadata["icons"] = uploaded
    ? {
        icon: [{ url: uploaded }],
        shortcut: [{ url: uploaded }],
        apple: [{ url: uploaded }],
      }
    : {
        icon: [
          { url: "/Upload/favicon/favicon.ico" },
          { url: "/Upload/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
          { url: "/Upload/favicon/favicon.svg", type: "image/svg+xml" },
        ],
        apple: "/Upload/favicon/apple-touch-icon.png",
      };
  return {
    metadataBase: new URL(s.SiteUrl),
    title: { default: s.Title, template: `%s | ${s.SiteName}` },
    description: s.Description,
    keywords: s.Keywords?.split(",").map((k) => k.trim()).filter(Boolean),
    applicationName: s.SiteName,
    icons,
    manifest: "/Upload/favicon/site.webmanifest",
    openGraph: {
      type: "website",
      siteName: s.SiteName,
      title: s.Title,
      description: s.Description,
      url: s.SiteUrl,
      locale: ogLocale(s.SiteLanguage),
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
      locale: ogLocale(s.SiteLanguage),
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
  const tags = c.ContentKeywords?.split(",").map((t) => t.trim()).filter(Boolean);
  const authorUrl = c.AuthorSlug ? absoluteUrl(s.SiteUrl, `/author/${c.AuthorSlug}`) : null;
  const twitterHandle = s.TwitterHandle ? `@${s.TwitterHandle.replace(/^@/, "")}` : undefined;
  return {
    title: c.ContentTitle,
    description: desc,
    keywords: tags,
    authors: c.AuthorName
      ? [{ name: c.AuthorName, url: authorUrl ?? undefined }]
      : undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: s.SiteName,
      title: c.ContentTitle,
      description: desc,
      url,
      locale: ogLocale(s.SiteLanguage),
      images: img
        ? [{ url: img, alt: c.ContentTitle, width: 1200, height: 630 }]
        : undefined,
      publishedTime: toISO(c.PublishDate),
      modifiedTime: toISO(c.ModifiedDate ?? c.PublishDate),
      section: c.CatName,
      tags,
      authors: authorUrl ? [authorUrl] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: c.ContentTitle,
      description: desc,
      images: img ? [img] : undefined,
      site: twitterHandle,
      creator: twitterHandle,
    },
    other: {
      "article:published_time": toISO(c.PublishDate),
      "article:modified_time": toISO(c.ModifiedDate ?? c.PublishDate),
      ...(c.AuthorName ? { "article:author": c.AuthorName } : {}),
      ...(c.CatName ? { "article:section": c.CatName } : {}),
      // Twitter byline labels — show "Written by" + author on share cards,
      // gives editorial articles a stronger preview when shared.
      ...(c.AuthorName
        ? {
            "twitter:label1": "Written by",
            "twitter:data1": c.AuthorName,
          }
        : {}),
      ...(c.CatName
        ? {
            "twitter:label2": "Filed under",
            "twitter:data2": c.CatName,
          }
        : {}),
      // Legacy News keywords meta — Google deprecated it but some news
      // aggregators still parse it; cheap to include when we already have the
      // tag list.
      ...(tags && tags.length > 0 ? { news_keywords: tags.join(", ") } : {}),
    },
  };
}

export function newsArticleJsonLd(s: Settings, c: Content, categorySeo: string) {
  const url = absoluteUrl(s.SiteUrl, `/${categorySeo}/${c.ContentSeo}`);
  const img = c.ContentImage ? absoluteUrl(s.SiteUrl, c.ContentImage) : s.CoverImage ?? undefined;
  const plain = (c.ContentDetail ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plain ? plain.split(/\s+/).length : undefined;
  // Google News expects ImageObject (or URL string) with explicit dimensions;
  // we generate the hero card at 1200x630, so advertise those so Google can
  // pick the right crop for News / Discover rails.
  const imageObject = img
    ? { "@type": "ImageObject", url: img, width: 1200, height: 630 }
    : undefined;
  const tags = c.ContentKeywords
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  // GEO / generative-engine signals: a real Person author when we have one,
  // citation-friendly fields (wordCount, articleBody snippet, isAccessibleForFree),
  // and a SpeakableSpecification so voice/AI surfaces can quote the lede.
  const author = c.AuthorName
    ? {
        "@type": "Person",
        name: c.AuthorName,
        url: c.AuthorSlug ? absoluteUrl(s.SiteUrl, `/author/${c.AuthorSlug}`) : undefined,
        image: c.AuthorAvatarURL ? absoluteUrl(s.SiteUrl, c.AuthorAvatarURL) : undefined,
        description: c.AuthorBio ?? undefined,
        jobTitle: "Reporter",
        worksFor: { "@type": "Organization", name: s.SiteName, url: s.SiteUrl },
      }
    : { "@type": "Organization", name: s.SiteName, url: s.SiteUrl };
  // ContentSource is the original news outlet we expanded the article from.
  // Surfacing it as schema.org `citation` is a strong GEO signal: AI surfaces
  // can attribute and link back to the upstream report.
  const source = parseSource(c.ContentSource);
  const citation = source?.href
    ? {
        "@type": "CreativeWork",
        url: source.href,
        ...(source.title ? { name: source.title } : {}),
      }
    : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: c.ContentTitle,
    alternativeHeadline: c.ContentShort ?? undefined,
    description: truncate(c.ContentDesc ?? c.ContentShort ?? "", 200),
    image: imageObject ? [imageObject] : undefined,
    thumbnailUrl: img,
    datePublished: toISO(c.PublishDate),
    dateCreated: toISO(c.CreatedDate ?? c.PublishDate),
    dateModified: toISO(c.ModifiedDate ?? c.PublishDate),
    articleSection: c.CatName,
    keywords: tags && tags.length > 0 ? tags : undefined,
    inLanguage: htmlLang(s.SiteLanguage),
    isAccessibleForFree: true,
    wordCount,
    articleBody: plain ? truncate(plain, 1200) : undefined,
    url,
    author,
    creator: author,
    publisher: {
      "@type": "NewsMediaOrganization",
      name: s.SiteName,
      url: s.SiteUrl,
      logo: s.SiteLogo
        ? { "@type": "ImageObject", url: absoluteUrl(s.SiteUrl, s.SiteLogo) }
        : undefined,
    },
    copyrightYear: new Date(c.PublishDate).getUTCFullYear(),
    copyrightHolder: { "@type": "Organization", name: s.SiteName, url: s.SiteUrl },
    isPartOf: { "@type": "WebSite", name: s.SiteName, url: s.SiteUrl },
    citation,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".content-body p:first-of-type"],
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

export function authorMetadata(s: Settings, a: Author): Metadata {
  const url = absoluteUrl(s.SiteUrl, `/author/${a.Slug}`);
  const title = `${a.DisplayName} — Author`;
  const desc = truncate(a.Bio ?? `Articles by ${a.DisplayName} on ${s.SiteName}.`, 200);
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      siteName: s.SiteName,
      title,
      description: desc,
      url,
      images: a.AvatarURL ? [{ url: absoluteUrl(s.SiteUrl, a.AvatarURL) }] : undefined,
    },
    twitter: {
      card: a.AvatarURL ? "summary" : "summary_large_image",
      title,
      description: desc,
      images: a.AvatarURL ? [absoluteUrl(s.SiteUrl, a.AvatarURL)] : undefined,
    },
  };
}

export function authorJsonLd(s: Settings, a: Author) {
  const url = absoluteUrl(s.SiteUrl, `/author/${a.Slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: a.DisplayName,
    url,
    image: a.AvatarURL ? absoluteUrl(s.SiteUrl, a.AvatarURL) : undefined,
    description: a.Bio ?? undefined,
    worksFor: { "@type": "Organization", name: s.SiteName, url: s.SiteUrl },
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
