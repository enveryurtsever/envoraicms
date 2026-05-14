export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Compact integer for view counts: 832 → "832", 1240 → "1.2k",
 *  18450 → "18.4k", 1_240_000 → "1.2m". Keeps the inline byline tight. */
export function formatCount(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "0";
  if (v < 1000) return String(Math.floor(v));
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(v / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0).replace(/\.0$/, "")}m`;
}

/** Compact "3 MIN / 4 HR / 2 DAY / 3 MON / 1 YR" used as a card timestamp
 *  badge — short enough to sit in a top-left corner overlay. */
export function formatRelativeShort(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "NEW";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "JUST";
  if (m < 60) return `${m} MIN`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} HR`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} DAY`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} MON`;
  const years = Math.floor(months / 12);
  return `${years} YR`;
}

export function formatDateLong(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function toISO(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString();
}

export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function absoluteUrl(base: string, path: string): string {
  if (!path) return base;
  if (/^https?:\/\//.test(path)) return path;
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export function contentThumb(src: string | null | undefined): string | null {
  if (!src) return null;
  // Pipeline + manual uploads both live under /Upload/content/. Thumbs sit
  // in /Upload/content/thumb/ alongside the originals.
  if (src.startsWith("/Upload/content/") && !src.startsWith("/Upload/content/thumb/")) {
    return src.replace("/Upload/content/", "/Upload/content/thumb/");
  }
  return src;
}

export function truncate(s: string | null | undefined, max = 160): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

/** Lowercase, drop diacritics, collapse anything non-alphanumeric to hyphens.
 *  Used by both the inline keyword-link sanitizer and the topic-chip renderer
 *  so /search/ URLs stay consistent and human-readable. */
export function toSearchSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseSource(src: unknown): { href?: string; title?: string } | null {
  if (!src) return null;
  if (typeof src === "string") {
    try {
      return JSON.parse(src);
    } catch {
      return null;
    }
  }
  if (typeof src === "object") return src as { href?: string; title?: string };
  return null;
}
