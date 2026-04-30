import { cookies } from "next/headers";

export type ColorMode = "light" | "dark";
export type ColorPreference = "light" | "dark" | "system";

export const COLOR_MODE_COOKIE = "env_theme";

export function isColorPreference(v: unknown): v is ColorPreference {
  return v === "light" || v === "dark" || v === "system";
}

export async function readColorPreference(): Promise<ColorPreference | null> {
  const c = await cookies();
  const raw = c.get(COLOR_MODE_COOKIE)?.value;
  return isColorPreference(raw) ? raw : null;
}

export function resolveColorMode(
  preference: ColorPreference | null,
  fallback: "light" | "dark" | "system" | null,
): ColorMode {
  const pick = preference ?? fallback ?? "light";
  // "system" at SSR has no hint — fall back to light; the client script may override below.
  return pick === "dark" ? "dark" : "light";
}
