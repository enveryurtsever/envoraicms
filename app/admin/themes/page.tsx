import { listThemes, getActiveThemeSlug } from "@/lib/queries/themes";
import { ThemesClient } from "./ThemesClient";

export const dynamic = "force-dynamic";

export default async function ThemesPage() {
  const [themes, activeSlug] = await Promise.all([
    listThemes(),
    getActiveThemeSlug(),
  ]);
  return <ThemesClient themes={themes} activeSlug={activeSlug} />;
}
