import { getActiveThemeSlug } from "@/lib/queries/themes";
import { loadThemeHomepage } from "@/themes/registry";

// The root layout reads request headers/cookies (admin-vs-site chrome, theme),
// which forces this whole tree to render dynamically. Declaring it explicitly
// stops Next from attempting a static prerender that would throw
// DYNAMIC_SERVER_USAGE. DB reads stay cached via unstable_cache in lib/queries.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const slug = await getActiveThemeSlug();
  const Theme = await loadThemeHomepage(slug);
  return <Theme />;
}
