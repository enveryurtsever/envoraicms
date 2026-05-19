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

// Languages, ordered: global defaults first (English, Turkish for project
// history), then Europe alphabetical by label, then the rest of the world.
// Add new entries by region so the admin dropdown stays scannable.
export const SITE_LANGUAGES: SiteLanguageOption[] = [
  { code: "en",    label: "English",            englishName: "English",              ogLocale: "en_US" },
  { code: "tr",    label: "Türkçe",             englishName: "Turkish",              ogLocale: "tr_TR" },

  // Europe
  { code: "sq",    label: "Shqip",              englishName: "Albanian",             ogLocale: "sq_AL" },
  { code: "be",    label: "Беларуская",         englishName: "Belarusian",           ogLocale: "be_BY" },
  { code: "bs",    label: "Bosanski",           englishName: "Bosnian",              ogLocale: "bs_BA" },
  { code: "bg",    label: "Български",          englishName: "Bulgarian",            ogLocale: "bg_BG" },
  { code: "ca",    label: "Català",             englishName: "Catalan",              ogLocale: "ca_ES" },
  { code: "hr",    label: "Hrvatski",           englishName: "Croatian",             ogLocale: "hr_HR" },
  { code: "cs",    label: "Čeština",            englishName: "Czech",                ogLocale: "cs_CZ" },
  { code: "da",    label: "Dansk",              englishName: "Danish",               ogLocale: "da_DK" },
  { code: "nl",    label: "Nederlands",         englishName: "Dutch",                ogLocale: "nl_NL" },
  { code: "et",    label: "Eesti",              englishName: "Estonian",             ogLocale: "et_EE" },
  { code: "fi",    label: "Suomi",              englishName: "Finnish",              ogLocale: "fi_FI" },
  { code: "fr",    label: "Français",           englishName: "French",               ogLocale: "fr_FR" },
  { code: "ga",    label: "Gaeilge",            englishName: "Irish",                ogLocale: "ga_IE" },
  { code: "de",    label: "Deutsch",            englishName: "German",               ogLocale: "de_DE" },
  { code: "el",    label: "Ελληνικά",           englishName: "Greek",                ogLocale: "el_GR" },
  { code: "hu",    label: "Magyar",             englishName: "Hungarian",            ogLocale: "hu_HU" },
  { code: "is",    label: "Íslenska",           englishName: "Icelandic",            ogLocale: "is_IS" },
  { code: "it",    label: "Italiano",           englishName: "Italian",              ogLocale: "it_IT" },
  { code: "lv",    label: "Latviešu",           englishName: "Latvian",              ogLocale: "lv_LV" },
  { code: "lt",    label: "Lietuvių",           englishName: "Lithuanian",           ogLocale: "lt_LT" },
  { code: "mk",    label: "Македонски",         englishName: "Macedonian",           ogLocale: "mk_MK" },
  { code: "mt",    label: "Malti",              englishName: "Maltese",              ogLocale: "mt_MT" },
  { code: "no",    label: "Norsk (bokmål)",     englishName: "Norwegian",            ogLocale: "nb_NO" },
  { code: "pl",    label: "Polski",             englishName: "Polish",               ogLocale: "pl_PL" },
  { code: "pt",    label: "Português",          englishName: "Portuguese",           ogLocale: "pt_PT" },
  { code: "ro",    label: "Română",             englishName: "Romanian",             ogLocale: "ro_RO" },
  { code: "ru",    label: "Русский",            englishName: "Russian",              ogLocale: "ru_RU" },
  { code: "sr",    label: "Српски",             englishName: "Serbian",              ogLocale: "sr_RS" },
  { code: "sk",    label: "Slovenčina",         englishName: "Slovak",               ogLocale: "sk_SK" },
  { code: "sl",    label: "Slovenščina",        englishName: "Slovenian",            ogLocale: "sl_SI" },
  { code: "es",    label: "Español",            englishName: "Spanish",              ogLocale: "es_ES" },
  { code: "sv",    label: "Svenska",            englishName: "Swedish",              ogLocale: "sv_SE" },
  { code: "uk",    label: "Українська",         englishName: "Ukrainian",            ogLocale: "uk_UA" },

  // Rest of the world
  { code: "pt-BR", label: "Português (Brasil)", englishName: "Brazilian Portuguese", ogLocale: "pt_BR" },
  { code: "ar",    label: "العربية",            englishName: "Arabic",               ogLocale: "ar_AR" },
  { code: "ja",    label: "日本語",              englishName: "Japanese",             ogLocale: "ja_JP" },
  { code: "ko",    label: "한국어",              englishName: "Korean",               ogLocale: "ko_KR" },
  { code: "zh-CN", label: "简体中文",            englishName: "Simplified Chinese",   ogLocale: "zh_CN" },
  { code: "zh-TW", label: "繁體中文",            englishName: "Traditional Chinese",  ogLocale: "zh_TW" },
  { code: "hi",    label: "हिन्दी",              englishName: "Hindi",                ogLocale: "hi_IN" },
  { code: "id",    label: "Bahasa Indonesia",   englishName: "Indonesian",           ogLocale: "id_ID" },
  { code: "vi",    label: "Tiếng Việt",         englishName: "Vietnamese",           ogLocale: "vi_VN" },
  { code: "th",    label: "ไทย",                englishName: "Thai",                 ogLocale: "th_TH" },
  { code: "he",    label: "עברית",             englishName: "Hebrew",               ogLocale: "he_IL" },
  { code: "fa",    label: "فارسی",              englishName: "Persian",              ogLocale: "fa_IR" },
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

// Countries, ordered: Anglosphere first (most common targets), then Europe
// alphabetical, then the rest. Add new entries by region.
export const SITE_LOCATIONS: SiteLocationOption[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "IE", label: "Ireland" },
  { code: "NZ", label: "New Zealand" },

  // Europe
  { code: "AL", label: "Albania" },
  { code: "AD", label: "Andorra" },
  { code: "AT", label: "Austria" },
  { code: "BY", label: "Belarus" },
  { code: "BE", label: "Belgium" },
  { code: "BA", label: "Bosnia and Herzegovina" },
  { code: "BG", label: "Bulgaria" },
  { code: "HR", label: "Croatia" },
  { code: "CY", label: "Cyprus" },
  { code: "CZ", label: "Czechia" },
  { code: "DK", label: "Denmark" },
  { code: "EE", label: "Estonia" },
  { code: "FI", label: "Finland" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "GR", label: "Greece" },
  { code: "HU", label: "Hungary" },
  { code: "IS", label: "Iceland" },
  { code: "IT", label: "Italy" },
  { code: "XK", label: "Kosovo" },
  { code: "LV", label: "Latvia" },
  { code: "LI", label: "Liechtenstein" },
  { code: "LT", label: "Lithuania" },
  { code: "LU", label: "Luxembourg" },
  { code: "MT", label: "Malta" },
  { code: "MD", label: "Moldova" },
  { code: "MC", label: "Monaco" },
  { code: "ME", label: "Montenegro" },
  { code: "NL", label: "Netherlands" },
  { code: "MK", label: "North Macedonia" },
  { code: "NO", label: "Norway" },
  { code: "PL", label: "Poland" },
  { code: "PT", label: "Portugal" },
  { code: "RO", label: "Romania" },
  { code: "RU", label: "Russia" },
  { code: "SM", label: "San Marino" },
  { code: "RS", label: "Serbia" },
  { code: "SK", label: "Slovakia" },
  { code: "SI", label: "Slovenia" },
  { code: "ES", label: "Spain" },
  { code: "SE", label: "Sweden" },
  { code: "CH", label: "Switzerland" },
  { code: "TR", label: "Türkiye" },
  { code: "UA", label: "Ukraine" },

  // Asia
  { code: "IN", label: "India" },
  { code: "ID", label: "Indonesia" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "CN", label: "China" },
  { code: "TW", label: "Taiwan" },
  { code: "TH", label: "Thailand" },
  { code: "VN", label: "Vietnam" },
  { code: "PH", label: "Philippines" },
  { code: "MY", label: "Malaysia" },
  { code: "SG", label: "Singapore" },
  { code: "IL", label: "Israel" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },

  // Americas
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "AR", label: "Argentina" },
  { code: "CL", label: "Chile" },
  { code: "CO", label: "Colombia" },
  { code: "PE", label: "Peru" },

  // Africa
  { code: "ZA", label: "South Africa" },
  { code: "EG", label: "Egypt" },
  { code: "NG", label: "Nigeria" },
  { code: "MA", label: "Morocco" },
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
