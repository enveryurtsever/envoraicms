import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/queries/users";
import { getVersionStatus } from "@/lib/system/version";
import { getJob, isUpdaterEnabled } from "@/lib/system/update-job";
import { UpdateClient } from "./UpdateClient";

export const metadata = { title: "System update" };
export const dynamic = "force-dynamic";

export default async function SystemUpdatePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const user = await getUserById(session.uid);
  if (!user || user.Role !== "admin") redirect("/admin");

  const status = await getVersionStatus();
  const initialJob = getJob();
  const enabled = isUpdaterEnabled();

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>System update</h2>
          <div className="subtitle">
            Pull the latest GitHub release, take a backup, and reload the server.
          </div>
        </div>
      </div>
      <UpdateClient
        initialStatus={status}
        initialJob={initialJob}
        updaterEnabled={enabled}
      />
    </>
  );
}
