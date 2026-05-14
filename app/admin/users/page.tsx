import { Suspense } from "react";
import { listUsers } from "@/lib/queries/users";
import { getSession } from "@/lib/auth/session";
import { TableSkeleton } from "@/components/admin-ui/Skeletons";
import { UsersClient } from "./UsersClient";

export const metadata = { title: "Users" };

export default function UsersPage() {
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
      <UsersData />
    </Suspense>
  );
}

async function UsersData() {
  const [users, sess] = await Promise.all([listUsers(), getSession()]);
  return <UsersClient users={users} currentUserId={sess?.uid ?? null} />;
}
