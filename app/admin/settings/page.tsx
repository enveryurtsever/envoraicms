import { Suspense } from "react";
import { getSettings } from "@/lib/queries/settings";
import { listThemes } from "@/lib/queries/themes";
import { FormSkeleton } from "@/components/admin-ui/Skeletons";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
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
          <FormSkeleton rows={8} />
        </>
      }
    >
      <SettingsData />
    </Suspense>
  );
}

async function SettingsData() {
  const [settings, themes] = await Promise.all([getSettings(), listThemes()]);
  return <SettingsClient settings={settings} themes={themes} />;
}
