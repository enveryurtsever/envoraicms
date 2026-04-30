import { Suspense } from "react";
import { listThemes, getActiveThemeSlug } from "@/lib/queries/themes";
import { CardSkeleton } from "@/components/admin-ui/Skeletons";
import { ThemesClient } from "./ThemesClient";

export const dynamic = "force-dynamic";

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
  const [themes, activeSlug] = await Promise.all([
    listThemes(),
    getActiveThemeSlug(),
  ]);
  return <ThemesClient themes={themes} activeSlug={activeSlug} />;
}
