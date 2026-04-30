"use server";

import { revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  createAuthor,
  softDeleteAuthor,
  updateAuthor,
} from "@/lib/queries/authors";
import { saveMediaAsset } from "@/lib/uploads/settings-asset";
import { logAudit } from "@/lib/audit";

function slugify(s: string): string {
  return s.toLowerCase().replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

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

async function parseForm(fd: FormData) {
  const displayName = str(fd, "DisplayName") ?? "";
  const slugInput = str(fd, "Slug");
  const slug = slugify(slugInput || displayName);
  const file = fd.get("AvatarFile");
  const uploaded =
    file instanceof File && file.size > 0
      ? await saveMediaAsset(file, "author", slug || "author")
      : null;
  return {
    displayName,
    slug,
    bio: str(fd, "Bio"),
    avatarUrl: uploaded ?? str(fd, "AvatarURL"),
    email: str(fd, "Email"),
    catId: Number(fd.get("FK_CatID")) || null,
    isActive: bool(fd, "IsActive"),
  };
}

export async function createAuthorAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const data = await parseForm(fd);
  if (!data.displayName) throw new Error("Display name is required.");
  if (!data.slug) throw new Error("Could not derive a slug.");
  await createAuthor(data);
  await logAudit("authors", `"${data.displayName}" author added`);
  revalidateTag("authors");
}

export async function updateAuthorAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  const data = await parseForm(fd);
  if (!data.displayName) throw new Error("Display name is required.");
  await updateAuthor(id, data);
  await logAudit("authors", `"${data.displayName}" author updated`);
  revalidateTag("authors");
}

export async function deleteAuthorAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  await softDeleteAuthor(id);
  await logAudit("authors", `#${id} author deleted`);
  revalidateTag("authors");
}
