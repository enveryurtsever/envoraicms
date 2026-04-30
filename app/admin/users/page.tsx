import { listUsers } from "@/lib/queries/users";
import { getSession } from "@/lib/auth/session";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, sess] = await Promise.all([listUsers(), getSession()]);
  return <UsersClient users={users} currentUserId={sess?.uid ?? null} />;
}
