import { Suspense } from "react";
import { getSettings } from "@/lib/queries/settings";
import { FormSkeleton } from "@/components/admin-ui/Skeletons";
import { GoogleKitClient } from "./GoogleKitClient";

export const metadata = { title: "Google Kit" };

export default function GoogleKitPage() {
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
          <FormSkeleton rows={6} />
        </>
      }
    >
      <GoogleKitData />
    </Suspense>
  );
}

async function GoogleKitData() {
  const settings = await getSettings();
  return <GoogleKitClient settings={settings} />;
}
