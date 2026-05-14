import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import type { User, UserRole } from "@/lib/types";

const BASE_COLS = sql`
  "UserID", "Email", "Username", "DisplayName", "Role", "AvatarURL",
  "LastLoginAt",
  COALESCE("IsActive", TRUE) AS "IsActive",
  "CreatedDate"
`;

const loadUserById = unstable_cache(
  async (id: number): Promise<User | null> => {
    const rows = await sql<User[]>`
      SELECT ${BASE_COLS} FROM "Users"
      WHERE "UserID" = ${id} AND "IsDeleted" = FALSE
      LIMIT 1
    `;
    return rows[0] ?? null;
  },
  ["user:by-id"],
  { revalidate: 300, tags: ["users"] },
);

// Wrapped in unstable_cache so the admin layout's per-request getUserById
// (which runs on every admin navigation) hits the cache instead of issuing
// a Users SELECT each time. Invalidated by tag "users" on updates below.
export const getUserById = cache((id: number) => loadUserById(id));

export async function getUserByEmail(email: string): Promise<(User & { PasswordHash: string }) | null> {
  const rows = await sql<(User & { PasswordHash: string })[]>`
    SELECT ${BASE_COLS}, "PasswordHash" FROM "Users"
    WHERE "Email" = ${email} AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listUsers({
  limit = 50,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<User[]> {
  return sql<User[]>`
    SELECT ${BASE_COLS} FROM "Users"
    WHERE "IsDeleted" = FALSE
    ORDER BY "UserID" ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function countUsers(): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "Users" WHERE "IsDeleted" = FALSE
  `;
  return rows[0]?.c ?? 0;
}

export async function createUser(data: {
  email: string;
  username?: string | null;
  displayName?: string | null;
  passwordHash: string;
  role?: UserRole;
  creatorId?: number | null;
}): Promise<number> {
  const rows = await sql<{ UserID: number }[]>`
    INSERT INTO "Users" ("Email","Username","DisplayName","PasswordHash","Role","Fk_UserID")
    VALUES (
      ${data.email},
      ${data.username ?? null},
      ${data.displayName ?? null},
      ${data.passwordHash},
      ${data.role ?? "editor"},
      ${data.creatorId ?? null}
    )
    RETURNING "UserID"
  `;
  return rows[0].UserID;
}

export async function updateLastLogin(uid: number): Promise<void> {
  await sql`UPDATE "Users" SET "LastLoginAt" = NOW() WHERE "UserID" = ${uid}`;
}

export async function updateUserPassword(uid: number, passwordHash: string): Promise<void> {
  await sql`UPDATE "Users" SET "PasswordHash" = ${passwordHash} WHERE "UserID" = ${uid}`;
}

export async function updateUser(
  uid: number,
  data: { email?: string; username?: string | null; displayName?: string | null; role?: UserRole; isActive?: boolean },
): Promise<void> {
  await sql`
    UPDATE "Users" SET
      "Email"       = COALESCE(${data.email ?? null}, "Email"),
      "Username"    = ${data.username ?? null},
      "DisplayName" = ${data.displayName ?? null},
      "Role"        = COALESCE(${data.role ?? null}, "Role"),
      "IsActive"    = COALESCE(${data.isActive ?? null}, "IsActive")
    WHERE "UserID" = ${uid}
  `;
}

export async function softDeleteUser(uid: number): Promise<void> {
  await sql`UPDATE "Users" SET "IsDeleted" = TRUE, "IsActive" = FALSE WHERE "UserID" = ${uid}`;
}
