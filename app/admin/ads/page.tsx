import { Suspense } from "react";
import { listAdZones } from "@/lib/queries/adzones";
import { TableSkeleton } from "@/components/admin-ui/Skeletons";
import { AdsClient } from "./AdsClient";

export const dynamic = "force-dynamic";

export default function AdsPage() {
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
          <TableSkeleton rows={6} cols={4} />
        </>
      }
    >
      <AdsData />
    </Suspense>
  );
}

async function AdsData() {
  const zones = await listAdZones();
  return <AdsClient zones={zones} />;
}
