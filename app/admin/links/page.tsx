import { Suspense } from "react";
import { listAllLinks } from "@/lib/queries/admin-links";
import { TableSkeleton } from "@/components/admin-ui/Skeletons";
import { LinksClient } from "./LinksClient";

export const metadata = { title: "Pages" };

export default function LinksPage() {
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
          <TableSkeleton rows={5} cols={6} />
        </>
      }
    >
      <LinksData />
    </Suspense>
  );
}

async function LinksData() {
  const links = await listAllLinks();
  return <LinksClient links={links} />;
}
