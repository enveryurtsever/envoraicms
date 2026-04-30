"use server";
import { revalidateTag } from "next/cache";
import { requireRole, getSession } from "@/lib/auth/session";
import {
  createCategory,
  softDeleteCategory,
  updateCategory,
} from "@/lib/queries/admin-categories";
import { createRandomAuthorForCategory } from "@/lib/queries/authors";
import { getSettings } from "@/lib/queries/settings";
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
function num(fd: FormData, k: string, def = 0): number {
  const v = Number(fd.get(k));
  return Number.isFinite(v) ? v : def;
}

async function parseForm(fd: FormData) {
  const name = str(fd, "CatName") ?? "";
  const seo = str(fd, "CatSeo") ?? slugify(name);
  const slug = slugify(seo);
  // Optional file upload — persists under /Upload/category/<slug>-<ts>.webp.
  const file = fd.get("CatImageFile");
  const uploaded =
    file instanceof File && file.size > 0
      ? await saveMediaAsset(file, "category", slug || name)
      : null;
  return {
    catName: name,
    catTitle: str(fd, "CatTitle") ?? name,
    catSeo: slug,
    catDesc: str(fd, "CatDesc"),
    catKeywords: str(fd, "CatKeywords"),
    catImage: uploaded ?? str(fd, "CatImage"),
    catNumber: num(fd, "CatNumber", 0),
    headerMenu: bool(fd, "HeaderMenu"),
    footerMenu: bool(fd, "FooterMenu"),
    sideMenu: bool(fd, "SideMenu"),
    dropdownMenu: bool(fd, "DropdownMenu"),
    parentCatId: num(fd, "ParentCatID", 0),
    isActive: bool(fd, "IsActive"),
  };
}

export async function createCategoryAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const sess = await getSession();
  const data = await parseForm(fd);
  if (!data.catName) throw new Error("Category name is required.");
  if (!data.catSeo) throw new Error("Could not derive a slug.");
  const catId = await createCategory({ ...data, creatorId: sess?.uid ?? null });
  await logAudit("categories", `"${data.catName}" category added`);
  // Best-effort: spawn a random byline + portrait for this category. A network
  // hiccup on the avatar fetch shouldn't fail the category create.
  try {
    const settings = await getSettings();
    await createRandomAuthorForCategory({
      catId,
      catSlug: data.catSeo,
      catName: data.catName,
      siteName: settings.SiteName,
    });
    revalidateTag("authors");
  } catch (err) {
    console.error("[categories] auto-author creation failed", err);
  }
  revalidateTag("categories");
}

export async function updateCategoryAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  const data = await parseForm(fd);
  if (!data.catName) throw new Error("Category name is required.");
  await updateCategory(id, data);
  await logAudit("categories", `"${data.catName}" category updated`);
  revalidateTag("categories");
}

export async function deleteCategoryAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  await softDeleteCategory(id);
  await logAudit("categories", `#${id} category deleted`);
  revalidateTag("categories");
}
