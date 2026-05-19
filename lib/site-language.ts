// Single source of truth for the public site's language AND target geography.
// The admin picks a BCP47 language code and an ISO-2 country code in Settings;
// we map them to the variants each surface expects:
//   - <html lang="…">                — BCP47 (e.g. "tr", "en", "pt-BR")
//   - JSON-LD `inLanguage`           — BCP47
//   - OpenGraph `og:locale`          — "lang_TERRITORY" (e.g. "tr_TR")
//   - Google News `<news:language>`  — ISO-639 2-letter (e.g. "tr")
//   - SerpAPI `hl` / `geo`           — 2-letter language / ISO-2 country
//   - NewsNow `language` / `location`— 2-letter language / ISO-2 country
//   - AI prompts                     — human-readable language label

export type SiteLanguageOption = {
  /** BCP47 code stored in Settings.SiteLanguage. */
  code: string;
  /** Native-script label for the admin dropdown. */
  label: string;
  /** Human-readable English name passed into AI prompts ("Turkish"). */
  englishName: string;
  /** Open Graph "lang_TERRITORY" form. */
  ogLocale: string;
};

export const SITE_LANGUAGES: SiteLanguageOption[] = [
  { code: "en",    label: "English",            englishName: "English",              ogLocale: "en_US" },
  { code: "tr",    label: "Türkçe",             englishName: "Turkish",              ogLocale: "tr_TR" },
  { code: "de",    label: "Deutsch",            englishName: "German",               ogLocale: "de_DE" },
  { code: "fr",    label: "Français",           englishName: "French",               ogLocale: "fr_FR" },
  { code: "es",    label: "Español",            englishName: "Spanish",              ogLocale: "es_ES" },
  { code: "it",    label: "Italiano",           englishName: "Italian",              ogLocale: "it_IT" },
  { code: "pt",    label: "Português",          englishName: "Portuguese",           ogLocale: "pt_PT" },
  { code: "pt-BR", label: "Português (Brasil)", englishName: "Brazilian Portuguese", ogLocale: "pt_BR" },
  { code: "nl",    label: "Nederlands",         englishName: "Dutch",                ogLocale: "nl_NL" },
  { code: "pl",    label: "Polski",             englishName: "Polish",               ogLocale: "pl_PL" },
  { code: "ru",    label: "Русский",            englishName: "Russian",              ogLocale: "ru_RU" },
  { code: "uk",    label: "Українська",         englishName: "Ukrainian",            ogLocale: "uk_UA" },
  { code: "ar",    label: "العربية",            englishName: "Arabic",               ogLocale: "ar_AR" },
  { code: "ja",    label: "日本語",              englishName: "Japanese",             ogLocale: "ja_JP" },
  { code: "ko",    label: "한국어",              englishName: "Korean",               ogLocale: "ko_KR" },
  { code: "zh-CN", label: "简体中文",            englishName: "Simplified Chinese",   ogLocale: "zh_CN" },
  { code: "zh-TW", label: "繁體中文",            englishName: "Traditional Chinese",  ogLocale: "zh_TW" },
  { code: "hi",    label: "हिन्दी",              englishName: "Hindi",                ogLocale: "hi_IN" },
  { code: "id",    label: "Bahasa Indonesia",   englishName: "Indonesian",           ogLocale: "id_ID" },
];

const DEFAULT: SiteLanguageOption = SITE_LANGUAGES[0];

/** Resolve a stored Settings.SiteLanguage value to a known option, falling
 *  back to English when the column is null/unknown. */
function resolve(code: string | null | undefined): SiteLanguageOption {
  if (!code) return DEFAULT;
  const hit = SITE_LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  return hit ?? DEFAULT;
}

/** BCP47 — used for <html lang> and JSON-LD `inLanguage`. */
export function htmlLang(code: string | null | undefined): string {
  return resolve(code).code;
}

/** Open Graph `og:locale` — "lang_TERRITORY". */
export function ogLocale(code: string | null | undefined): string {
  return resolve(code).ogLocale;
}

/** Google News sitemap expects a 2-letter ISO-639 code; drop any region. */
export function newsLanguage(code: string | null | undefined): string {
  return resolve(code).code.split("-")[0].toLowerCase();
}

/** Human-readable English name of the language, suitable for AI prompts
 *  ("Write in {language}"). Falls back to "English". */
export function languageEnglishName(code: string | null | undefined): string {
  return resolve(code).englishName;
}

// ─────────────────────────────────────────────────────────────────────────
// SiteLocation — ISO-2 country code that targets news/trend providers.
// Stored as upper-case ("US","TR",…) in Settings.SiteLocation. Used by:
//   - SerpAPI Google Trends `geo` (upper-case ISO-2)
//   - NewsNow RapidAPI `location` (lower-case ISO-2)
// ─────────────────────────────────────────────────────────────────────────

export type SiteLocationOption = {
  /** ISO-2 country code stored in Settings.SiteLocation (upper-case). */
  code: string;
  /** Country name for the admin dropdown. */
  label: string;
};

export const SITE_LOCATIONS: SiteLocationOption[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "IN", label: "India" },
  { code: "TR", label: "Türkiye" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "PT", label: "Portugal" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "NL", label: "Netherlands" },
  { code: "PL", label: "Poland" },
  { code: "RU", label: "Russia" },
  { code: "UA", label: "Ukraine" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "CN", label: "China" },
  { code: "TW", label: "Taiwan" },
  { code: "ID", label: "Indonesia" },
  { code: "AR", label: "Argentina" },
];

const DEFAULT_LOCATION: SiteLocationOption = SITE_LOCATIONS[0];

function resolveLocation(code: string | null | undefined): SiteLocationOption {
  if (!code) return DEFAULT_LOCATION;
  const upper = code.toUpperCase();
  const hit = SITE_LOCATIONS.find((l) => l.code === upper);
  return hit ?? DEFAULT_LOCATION;
}

/** SerpAPI `geo` — upper-case ISO-2 country. */
export function serpapiGeo(code: string | null | undefined): string {
  return resolveLocation(code).code;
}

/** NewsNow `location` — lower-case ISO-2 country. */
export function newsnowLocation(code: string | null | undefined): string {
  return resolveLocation(code).code.toLowerCase();
}

/** Human-readable country name, suitable for AI prompts. */
export function locationEnglishName(code: string | null | undefined): string {
  return resolveLocation(code).label;
}
