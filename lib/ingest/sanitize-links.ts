import { toSearchSlug } from "@/lib/utils";

// The article AI is told to URL-encode spaces in /search/KEYWORD links, but
// frequently emits literal spaces or %20. This pass rewrites every internal
// /search/ href into a clean hyphenated slug — no spaces, no percent-encoding,
// readable in the URL bar and consistent with the topic chips.
export function fixSearchLinks(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(
    /href=(["'])\/search\/([^"']+)\1/gi,
    (_match, quote: string, kwPart: string) => {
      let decoded: string;
      try {
        decoded = decodeURIComponent(kwPart.replace(/\+/g, " "));
      } catch {
        decoded = kwPart.replace(/\+/g, " ");
      }
      const slug = toSearchSlug(decoded);
      if (!slug) return `href=${quote}/${quote}`;
      return `href=${quote}/search/${slug}${quote}`;
    },
  );
}
