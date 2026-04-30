import { listCronJobs } from "@/lib/queries/cronjobs";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { getPreflight } from "@/lib/queries/preflight";
import { CronJobsClient } from "./CronJobsClient";

export const dynamic = "force-dynamic";

export default async function CronJobsPage() {
  const [jobs, cats, preflight] = await Promise.all([
    listCronJobs(),
    listAllCategories(),
    getPreflight(),
  ]);
  return <CronJobsClient jobs={jobs} categories={cats} preflight={preflight} />;
}
