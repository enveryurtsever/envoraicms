import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import type { Settings, SocialLink } from "@/lib/types";

type Row = Omit<Settings, "SocialLinks"> & { SocialLinks: SocialLink[] | string | null };

const load = unstable_cache(
  async (): Promise<Settings | null> => {
    const rows = await sql<Row[]>`
      SELECT "SettingsID",
             COALESCE(NULLIF("Title",''),       'ENVORAICMS')        AS "Title",
             COALESCE(NULLIF("Description",''), '')                  AS "Description",
             COALESCE(NULLIF("Keywords",''),    '')                  AS "Keywords",
             COALESCE(NULLIF("SiteName",''),    'ENVORAICMS')        AS "SiteName",
             COALESCE(NULLIF("SiteUrl",''),     ${process.env.SITE_URL ?? 'http://localhost:3000'}) AS "SiteUrl",
             "SiteLogo", "Favicon", "CoverImage",
             "ContentUrl", "HeaderScripts",
             COALESCE("AdsEnabled", TRUE) AS "AdsEnabled",
             "GoogleAnalyticsID", "GoogleTagManagerID", "SearchConsoleMeta",
             "BingVerification", "DefaultOgImage", "TwitterHandle",
             "MetaAuthor",
             COALESCE("MetaRobots", 'index,follow') AS "MetaRobots",
             "FK_ThemeID",
             "PrimaryColor", "SecondaryColor",
             COALESCE("SiteLanguage", 'en') AS "SiteLanguage",
             COALESCE("SiteLocation", 'US') AS "SiteLocation",
             COALESCE("DefaultColorMode", 'light') AS "DefaultColorMode",
             COALESCE("AllowColorToggle", TRUE) AS "AllowColorToggle",
             COALESCE("ShowHeaderMenu", TRUE)   AS "ShowHeaderMenu",
             COALESCE("ShowFooterMenu", TRUE)   AS "ShowFooterMenu",
             COALESCE("ShowViewCounts", TRUE)   AS "ShowViewCounts",
             COALESCE("LlmsTxtEnabled", TRUE) AS "LlmsTxtEnabled",
             "LlmsTxtIntro",
             "AdsensePublisherID",
             COALESCE("AdsenseAutoAds", FALSE) AS "AdsenseAutoAds",
             "AdsenseExtraHead",
             COALESCE("IndexingEnabled", FALSE) AS "IndexingEnabled",
             "IndexingServiceAccountJSON",
             "MetaProvider", "ContentProvider", "TrendsProvider",
             COALESCE("SocialLinks", '[]'::jsonb) AS "SocialLinks"
      FROM "Settings"
      WHERE "IsDeleted" = false
      ORDER BY "SettingsID" ASC
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return null;
    const social: SocialLink[] = Array.isArray(r.SocialLinks)
      ? (r.SocialLinks as SocialLink[])
      : typeof r.SocialLinks === "string"
        ? safeParseArray(r.SocialLinks)
        : [];
    return { ...r, SocialLinks: social } as Settings;
  },
  ["settings"],
  { revalidate: 3600, tags: ["settings"] }
);

function safeParseArray(s: string): SocialLink[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Centralized fallback for editorial images (article hero, card grids, etc.).
// Honors Settings.CoverImage when the operator uploaded one in admin; otherwise
// falls back to the static placeholder shipped under public/. Cached with
// React's cache() so repeated calls in the same request are free.
const STATIC_COVER_FALLBACK = "/Upload/default-cover.jpg";
export const getDefaultCover = cache(async (): Promise<string> => {
  const s = await load();
  const uploaded = s?.CoverImage?.trim();
  return uploaded && uploaded.length > 0 ? uploaded : STATIC_COVER_FALLBACK;
});

export const getSettings = cache(async () => {
  const s = await load();
  if (!s) {
    return {
      SettingsID: 0,
      Title: "ENVORAICMS",
      Description: "ENVORAICMS — dinamik content platformu",
      Keywords: "news, content, cms",
      SiteName: "ENVORAICMS",
      SiteUrl: process.env.SITE_URL ?? "https://envoraicms.com",
      SiteLogo: null,
      Favicon: null,
      CoverImage: "/Upload/envoraicms_cover.jpg",
      ContentUrl: "",
      HeaderScripts: null,
      AdsEnabled: true,
      GoogleAnalyticsID: null,
      GoogleTagManagerID: null,
      SearchConsoleMeta: null,
      BingVerification: null,
      DefaultOgImage: null,
      TwitterHandle: null,
      MetaAuthor: null,
      MetaRobots: "index,follow",
      FK_ThemeID: null,
      PrimaryColor: null,
      SecondaryColor: null,
      SiteLanguage: "en",
      SiteLocation: "US",
      DefaultColorMode: "light",
      AllowColorToggle: true,
      ShowHeaderMenu: true,
      ShowFooterMenu: true,
      ShowViewCounts: true,
      LlmsTxtEnabled: true,
      LlmsTxtIntro: null,
      SocialLinks: [],
      AdsensePublisherID: null,
      AdsenseAutoAds: false,
      AdsenseExtraHead: null,
      IndexingEnabled: false,
      IndexingServiceAccountJSON: null,
      MetaProvider: null,
      ContentProvider: null,
      TrendsProvider: null,
    } satisfies Settings;
  }
  return s;
});
