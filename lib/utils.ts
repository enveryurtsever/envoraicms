export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
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
  return src.startsWith("/Content/") && !src.startsWith("/Content/thumb/")
    ? src.replace("/Content/", "/Content/thumb/")
    : src;
}

export function truncate(s: string | null | undefined, max = 160): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
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
