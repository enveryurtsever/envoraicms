"use server";

import { revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import type { SocialLink } from "@/lib/types";
import { saveSettingsAsset, type AssetKind } from "@/lib/uploads/settings-asset";
import { logAudit } from "@/lib/audit";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

async function uploadIfPresent(
  fd: FormData,
  key: string,
  kind: AssetKind
): Promise<string | null> {
  const v = fd.get(key);
  if (!(v instanceof File) || v.size === 0) return null;
  return saveSettingsAsset(v, kind);
}

function parseSocialLinks(fd: FormData): SocialLink[] {
  // New structured form: socialLinks[i][platform], socialLinks[i][url],
  // socialLinks[i][isActive]. We collect all numeric indices, then drop empties
  // and dedupe by platform.
  const buckets = new Map<string, { platform?: string; url?: string; isActive?: string }>();
  for (const [key, value] of fd.entries()) {
    const m = key.match(/^socialLinks\[(\d+)\]\[(platform|url|isActive)\]$/);
    if (!m) continue;
    const [, idx, field] = m;
    const b = buckets.get(idx) ?? {};
    if (typeof value === "string") {
      (b as Record<string, string>)[field] = value;
    }
    buckets.set(idx, b);
  }
  const list: SocialLink[] = [];
  let order = 0;
  for (const [, b] of [...buckets.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const platform = (b.platform ?? "").toLowerCase().trim();
    const url = (b.url ?? "").trim();
    if (!platform || !url) continue;
    list.push({
      platform,
      url,
      icon: platform,
      order: order++,
      isActive: b.isActive === "on" || b.isActive === "true",
    });
  }
  if (list.length > 0) return list;

  // Legacy JSON fallback (kept for backwards compat with older clients).
  const raw = String(fd.get("socialLinksJson") ?? "");
  if (!raw.trim()) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x.platform === "string" && typeof x.url === "string")
      .map((x, i) => ({
        platform: String(x.platform).toLowerCase().trim(),
        url: String(x.url).trim(),
        icon: x.icon ? String(x.icon) : undefined,
        order: typeof x.order === "number" ? x.order : i,
        isActive: x.isActive !== false,
      }));
  } catch {
    return [];
  }
}

export async function saveSettings(formData: FormData): Promise<void> {
  // Admin-only: this action writes HeaderScripts (raw HTML rendered on every public page).
  await requireRole(["admin"]);

  const uploadedLogo = await uploadIfPresent(formData, "SiteLogoFile", "logo");
  const uploadedCover = await uploadIfPresent(formData, "CoverImageFile", "cover");
  const uploadedFavicon = await uploadIfPresent(formData, "FaviconFile", "favicon");

  const data = {
    Title: str(formData, "Title"),
    Description: str(formData, "Description"),
    Keywords: str(formData, "Keywords"),
    SiteName: str(formData, "SiteName"),
    SiteUrl: str(formData, "SiteUrl"),
    SiteLanguage: str(formData, "SiteLanguage") ?? "en",
    SiteLocation: (str(formData, "SiteLocation") ?? "US").toUpperCase(),
    SiteLogo: uploadedLogo ?? str(formData, "SiteLogo"),
    Favicon: uploadedFavicon ?? str(formData, "Favicon"),
    CoverImage: uploadedCover ?? str(formData, "CoverImage"),
    ContentUrl: str(formData, "ContentUrl"),
    HeaderScripts: str(formData, "HeaderScripts"),
    AdsEnabled: bool(formData, "AdsEnabled"),
    BingVerification: str(formData, "BingVerification"),
    DefaultOgImage: str(formData, "DefaultOgImage"),
    TwitterHandle: str(formData, "TwitterHandle"),
    MetaAuthor: str(formData, "MetaAuthor"),
    MetaRobots: str(formData, "MetaRobots") ?? "index,follow",
    DefaultColorMode: str(formData, "DefaultColorMode") ?? "light",
    AllowColorToggle: bool(formData, "AllowColorToggle"),
    ShowHeaderMenu: bool(formData, "ShowHeaderMenu"),
    ShowFooterMenu: bool(formData, "ShowFooterMenu"),
    ShowViewCounts: bool(formData, "ShowViewCounts"),
    LlmsTxtEnabled: bool(formData, "LlmsTxtEnabled"),
    LlmsTxtIntro: str(formData, "LlmsTxtIntro"),
    FK_ThemeID: Number(formData.get("FK_ThemeID")) || null,
    MetaProvider: str(formData, "MetaProvider"),
    ContentProvider: str(formData, "ContentProvider"),
    TrendsProvider: str(formData, "TrendsProvider"),
  };
  const social = parseSocialLinks(formData);

  const existing = await sql<{ SettingsID: number }[]>`
    SELECT "SettingsID" FROM "Settings" WHERE "IsDeleted" = FALSE
    ORDER BY "SettingsID" ASC LIMIT 1
  `;

  if (existing.length === 0) {
    await sql`
      INSERT INTO "Settings" (
        "Title","Description","Keywords","SiteName","SiteUrl","SiteLogo",
        "Favicon","CoverImage","ContentUrl","HeaderScripts","AdsEnabled",
        "BingVerification",
        "DefaultOgImage","TwitterHandle","MetaAuthor","MetaRobots",
        "FK_ThemeID","SiteLanguage","SiteLocation","DefaultColorMode","AllowColorToggle",
        "ShowHeaderMenu","ShowFooterMenu","ShowViewCounts",
        "LlmsTxtEnabled","LlmsTxtIntro","SocialLinks",
        "MetaProvider","ContentProvider","TrendsProvider",
        "FK_LangID","CreatedDate"
      ) VALUES (
        ${data.Title}, ${data.Description}, ${data.Keywords}, ${data.SiteName},
        ${data.SiteUrl}, ${data.SiteLogo}, ${data.Favicon},
        ${data.CoverImage}, ${data.ContentUrl},
        ${data.HeaderScripts}, ${data.AdsEnabled},
        ${data.BingVerification}, ${data.DefaultOgImage}, ${data.TwitterHandle},
        ${data.MetaAuthor}, ${data.MetaRobots},
        ${data.FK_ThemeID}, ${data.SiteLanguage}, ${data.SiteLocation},
        ${data.DefaultColorMode}, ${data.AllowColorToggle},
        ${data.ShowHeaderMenu}, ${data.ShowFooterMenu}, ${data.ShowViewCounts},
        ${data.LlmsTxtEnabled}, ${data.LlmsTxtIntro}, ${sql.json(social)},
        ${data.MetaProvider}, ${data.ContentProvider}, ${data.TrendsProvider},
        1, NOW()
      )
    `;
  } else {
    await sql`
      UPDATE "Settings" SET
        "Title"              = ${data.Title},
        "Description"        = ${data.Description},
        "Keywords"           = ${data.Keywords},
        "SiteName"           = ${data.SiteName},
        "SiteUrl"            = ${data.SiteUrl},
        "SiteLogo"           = ${data.SiteLogo},
        "Favicon"            = ${data.Favicon},
        "CoverImage"         = ${data.CoverImage},
        "ContentUrl"         = ${data.ContentUrl},
        "HeaderScripts"      = ${data.HeaderScripts},
        "AdsEnabled"         = ${data.AdsEnabled},
        "BingVerification"   = ${data.BingVerification},
        "DefaultOgImage"     = ${data.DefaultOgImage},
        "TwitterHandle"      = ${data.TwitterHandle},
        "MetaAuthor"         = ${data.MetaAuthor},
        "MetaRobots"         = ${data.MetaRobots},
        "FK_ThemeID"         = ${data.FK_ThemeID},
        "SiteLanguage"       = ${data.SiteLanguage},
        "SiteLocation"       = ${data.SiteLocation},
        "DefaultColorMode"   = ${data.DefaultColorMode},
        "AllowColorToggle"   = ${data.AllowColorToggle},
        "ShowHeaderMenu"     = ${data.ShowHeaderMenu},
        "ShowFooterMenu"     = ${data.ShowFooterMenu},
        "ShowViewCounts"     = ${data.ShowViewCounts},
        "LlmsTxtEnabled"     = ${data.LlmsTxtEnabled},
        "LlmsTxtIntro"       = ${data.LlmsTxtIntro},
        "SocialLinks"        = ${sql.json(social)},
        "MetaProvider"       = ${data.MetaProvider},
        "ContentProvider"    = ${data.ContentProvider},
        "TrendsProvider"     = ${data.TrendsProvider}
      WHERE "SettingsID" = ${existing[0].SettingsID}
    `;
  }

  revalidateTag("settings");
  await logAudit("settings", "site settings updated");
}
