import { getActiveThemeSlug } from "@/lib/queries/themes";
import { loadThemeHomepage } from "@/themes/registry";

export const revalidate = 30;

export default async function HomePage() {
  const slug = await getActiveThemeSlug();
  const Theme = await loadThemeHomepage(slug);
  return <Theme />;
}
