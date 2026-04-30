import "server-only";
import type { ComponentType } from "react";

// Allowlist: slug → dynamic import. External input cannot pull arbitrary paths.
const LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {
  classic: () => import("./classic/Homepage"),
  magazine: () => import("./magazine/Homepage"),
  minimal: () => import("./minimal/Homepage"),
};

export async function loadThemeHomepage(
  slug: string,
): Promise<ComponentType> {
  const loader = LOADERS[slug] ?? LOADERS.classic;
  const mod = await loader();
  return mod.default;
}

export const KNOWN_THEME_SLUGS = Object.keys(LOADERS);
