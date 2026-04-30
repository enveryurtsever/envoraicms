"use server";
import { revalidateTag } from "next/cache";
import { requireRole, getSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import {
  createUser,
  softDeleteUser,
  updateUser,
  updateUserPassword,
} from "@/lib/queries/users";
import type { UserRole } from "@/lib/types";
import { logAudit } from "@/lib/audit";

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
function bool(fd: FormData, k: string): boolean {
  const v = fd.get(k);
  return v === "on" || v === "true";
}

function parseRole(v: string | null): UserRole {
  return v === "admin" || v === "editor" || v === "viewer" ? v : "editor";
}

export async function createUserAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const sess = await getSession();
  const email = str(fd, "Email");
  const password = str(fd, "Password");
  if (!email) throw new Error("Email is required.");
  if (!password) throw new Error("Password is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const hash = await hashPassword(password);
  await createUser({
    email,
    username: str(fd, "Username"),
    displayName: str(fd, "DisplayName"),
    role: parseRole(str(fd, "Role")),
    passwordHash: hash,
    creatorId: sess?.uid ?? null,
  });
  await logAudit("users", `"${email}" user added`);
  revalidateTag("users");
}

export async function updateUserAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const uid = Number(fd.get("id"));
  if (!Number.isFinite(uid)) throw new Error("Invalid id.");
  const email = str(fd, "Email");
  await updateUser(uid, {
    email: email ?? undefined,
    username: str(fd, "Username"),
    displayName: str(fd, "DisplayName"),
    role: parseRole(str(fd, "Role")),
    isActive: bool(fd, "IsActive"),
  });
  const newPw = str(fd, "NewPassword");
  if (newPw) {
    if (newPw.length < 8) throw new Error("New password must be at least 8 characters.");
    await updateUserPassword(uid, await hashPassword(newPw));
    await logAudit("users", `"${email ?? `#${uid}`}" password changed`);
  }
  await logAudit("users", `"${email ?? `#${uid}`}" user updated`);
  revalidateTag("users");
}

export async function deleteUserAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const sess = await getSession();
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  if (sess && sess.uid === id) throw new Error("You cannot delete your own account.");
  await softDeleteUser(id);
  await logAudit("users", `#${id} user deleted`);
  revalidateTag("users");
}
