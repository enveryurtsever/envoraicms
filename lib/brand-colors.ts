// Primary/secondary brand color helpers. Admin saves hex strings on Settings;
// the layout converts them to "R G B" channel triples that Tailwind plugs into
// `rgb(var(--brand-rgb) / <alpha-value>)` so utilities like bg-brand/10 still
// resolve to the right alpha-modified color.

export const DEFAULT_PRIMARY = "#D21F2A";
export const DEFAULT_SECONDARY = "#0B1E3B";

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normalize "#abc" / "abc" / "#aabbcc" to "#aabbcc". Returns null when invalid. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.trim().match(HEX);
  if (!m) return null;
  const body = m[1];
  const full =
    body.length === 3
      ? body.split("").map((c) => c + c).join("")
      : body;
  return `#${full.toLowerCase()}`;
}

/** "#D21F2A" → "210 31 42". Caller is responsible for passing a valid hex. */
export function hexToRgbChannels(hex: string): string {
  const clean = hex.replace(/^#/, "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Build the inline CSS block injected into <head> for runtime brand colors. */
export function brandColorsCss(
  primary: string | null | undefined,
  secondary: string | null | undefined,
): string {
  const p = normalizeHex(primary) ?? DEFAULT_PRIMARY;
  const s = normalizeHex(secondary) ?? DEFAULT_SECONDARY;
  return `:root{--brand-rgb:${hexToRgbChannels(p)};--navy-rgb:${hexToRgbChannels(s)};}`;
}
