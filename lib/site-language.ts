// Single source of truth for the public site's language. The admin picks a
// BCP47 code in Settings; we map it to the variants each surface expects:
//   - <html lang="…">                — BCP47 (e.g. "tr", "en", "pt-BR")
//   - JSON-LD `inLanguage`           — BCP47
//   - OpenGraph `og:locale`          — "lang_TERRITORY" (e.g. "tr_TR")
//   - Google News `<news:language>`  — ISO-639 2-letter (e.g. "tr")

export type SiteLanguageOption = {
  /** BCP47 code stored in Settings.SiteLanguage. */
  code: string;
  /** Native-script label for the admin dropdown. */
  label: string;
  /** Open Graph "lang_TERRITORY" form. */
  ogLocale: string;
};

export const SITE_LANGUAGES: SiteLanguageOption[] = [
  { code: "en",    label: "English",            ogLocale: "en_US" },
  { code: "tr",    label: "Türkçe",             ogLocale: "tr_TR" },
  { code: "de",    label: "Deutsch",            ogLocale: "de_DE" },
  { code: "fr",    label: "Français",           ogLocale: "fr_FR" },
  { code: "es",    label: "Español",            ogLocale: "es_ES" },
  { code: "it",    label: "Italiano",           ogLocale: "it_IT" },
  { code: "pt",    label: "Português",          ogLocale: "pt_PT" },
  { code: "pt-BR", label: "Português (Brasil)", ogLocale: "pt_BR" },
  { code: "nl",    label: "Nederlands",         ogLocale: "nl_NL" },
  { code: "pl",    label: "Polski",             ogLocale: "pl_PL" },
  { code: "ru",    label: "Русский",            ogLocale: "ru_RU" },
  { code: "uk",    label: "Українська",         ogLocale: "uk_UA" },
  { code: "ar",    label: "العربية",            ogLocale: "ar_AR" },
  { code: "ja",    label: "日本語",              ogLocale: "ja_JP" },
  { code: "ko",    label: "한국어",              ogLocale: "ko_KR" },
  { code: "zh-CN", label: "简体中文",            ogLocale: "zh_CN" },
  { code: "zh-TW", label: "繁體中文",            ogLocale: "zh_TW" },
  { code: "hi",    label: "हिन्दी",              ogLocale: "hi_IN" },
  { code: "id",    label: "Bahasa Indonesia",   ogLocale: "id_ID" },
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
