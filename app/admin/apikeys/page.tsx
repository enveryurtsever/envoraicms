import { Suspense } from "react";
import { listApiKeys } from "@/lib/queries/apikeys";
import { TableSkeleton } from "@/components/admin-ui/Skeletons";
import { ApiKeysClient } from "./ApiKeysClient";

export const metadata = { title: "API Keys" };

export default function ApiKeysPage() {
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
          <TableSkeleton rows={4} cols={6} />
        </>
      }
    >
      <ApiKeysData />
    </Suspense>
  );
}

async function ApiKeysData() {
  const keys = await listApiKeys();
  return <ApiKeysClient keys={keys} />;
}
