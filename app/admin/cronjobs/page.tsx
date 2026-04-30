import { Suspense } from "react";
import { listCronJobs } from "@/lib/queries/cronjobs";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { getPreflight } from "@/lib/queries/preflight";
import { TableSkeleton } from "@/components/admin-ui/Skeletons";
import { CronJobsClient } from "./CronJobsClient";

export const dynamic = "force-dynamic";

export default function CronJobsPage() {
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
          <TableSkeleton rows={5} cols={7} />
        </>
      }
    >
      <CronJobsData />
    </Suspense>
  );
}

async function CronJobsData() {
  const [jobs, cats, preflight] = await Promise.all([
    listCronJobs(),
    listAllCategories(),
    getPreflight(),
  ]);
  return <CronJobsClient jobs={jobs} categories={cats} preflight={preflight} />;
}
