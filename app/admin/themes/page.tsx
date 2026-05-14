import { Suspense } from "react";
import { listThemes, getActiveThemeSlug } from "@/lib/queries/themes";
import { getSettings } from "@/lib/queries/settings";
import { CardSkeleton } from "@/components/admin-ui/Skeletons";
import { ThemesClient } from "./ThemesClient";

export const metadata = { title: "Themes" };

export default function ThemesPage() {
  return (
    <Suspense
      fallback={
        <>
          <div className="admin-header">
            <div>
              <div className="adm-skel adm-skel-title" />
              <div className="adm-skel adm-skel-sub" />
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1rem",
            }}
          >
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
          </div>
        </>
      }
    >
      <ThemesData />
    </Suspense>
  );
}

async function ThemesData() {
  const [themes, activeSlug, settings] = await Promise.all([
    listThemes(),
    getActiveThemeSlug(),
    getSettings(),
  ]);
  return (
    <ThemesClient
      themes={themes}
      activeSlug={activeSlug}
      primaryColor={settings.PrimaryColor}
      secondaryColor={settings.SecondaryColor}
    />
  );
}
