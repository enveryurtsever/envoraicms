"use server";
import DOMPurify from "isomorphic-dompurify";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, getSession } from "@/lib/auth/session";
import {
  createContent,
  getAdminContentById,
  softDeleteContent,
  toggleContentActive,
  updateContent,
  type ContentInput,
} from "@/lib/queries/admin-contents";
import { buildContentUrl, submitIndexingFireAndForget } from "@/lib/indexing/submit";
import { saveMediaAsset } from "@/lib/uploads/settings-asset";
import { logAudit } from "@/lib/audit";

function slugify(s: string): string {
  return s.toLowerCase().replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
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
function num(fd: FormData, k: string): number {
  const v = Number(fd.get(k));
  return Number.isFinite(v) ? v : 0;
}

/** An article is "live" — eligible for a Google Indexing URL_UPDATED ping —
 *  only when an editor marked it active AND the scheduled publish moment
 *  has arrived. Future-dated active rows are still IsActive=TRUE in the DB
 *  (so the activator can flip them later via the public PublishDate filter),
 *  but Google should hear about the URL on its actual publish date. The
 *  scheduler's activator handles the ping at that moment. */
function isLive(isActive: boolean, publishDate: Date): boolean {
  return isActive && publishDate.getTime() <= Date.now();
}

function sanitize(html: string | null): string | null {
  if (!html) return null;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "b", "i", "u", "a",
      "ul", "ol", "li", "blockquote",
      "h2", "h3", "h4",
      "img", "figure", "figcaption",
      "code", "pre", "hr",
    ],
    ALLOWED_ATTR: ["href", "title", "alt", "src", "target", "rel"],
  });
}

async function parseForm(fd: FormData): Promise<ContentInput> {
  const title = str(fd, "ContentTitle") ?? "";
  const seoRaw = str(fd, "ContentSeo") ?? title;
  const publishRaw = str(fd, "PublishDate");
  const publishDate = publishRaw ? new Date(publishRaw) : new Date();
  const seo = slugify(seoRaw);
  // Optional file upload — persists under /Upload/content/<slug>-<ts>.webp.
  const file = fd.get("ContentImageFile");
  const uploaded =
    file instanceof File && file.size > 0
      ? await saveMediaAsset(file, "content", seo || title)
      : null;
  return {
    catId: num(fd, "FK_CatID"),
    title,
    shortText: str(fd, "ContentShort"),
    detail: sanitize(str(fd, "ContentDetail")),
    alternateTitle: str(fd, "ContentAlternateTitle"),
    originalTitle: str(fd, "ContentOriginalTitle"),
    keywords: str(fd, "ContentKeywords"),
    desc: str(fd, "ContentDesc"),
    image: uploaded ?? str(fd, "ContentImage"),
    imagePrompt: str(fd, "ImagePrompt"),
    video: str(fd, "ContentVideo"),
    seo,
    url: str(fd, "ContentURL"),
    sourceHref: str(fd, "SourceHref"),
    sourceTitle: str(fd, "SourceTitle"),
    homepage: bool(fd, "Homepage"),
    isActive: bool(fd, "IsActive"),
    publishDate: Number.isNaN(publishDate.getTime()) ? new Date() : publishDate,
  };
}

export async function createContentAction(fd: FormData) {
  await requireRole(["admin", "editor"]);
  const sess = await getSession();
  const data = await parseForm(fd);
  if (!data.title || !data.seo || !data.catId) {
    redirect("/admin/contents/new?error=missing");
  }
  const id = await createContent({ ...data, creatorId: sess?.uid ?? null });
  await logAudit("contents", `"${data.title}" content added`);
  revalidateTag("contents");
  if (isLive(data.isActive, data.publishDate)) {
    const row = await getAdminContentById(id);
    if (row?.CatSeo) {
      const url = await buildContentUrl(row.CatSeo, data.seo);
      submitIndexingFireAndForget(id, url, "URL_UPDATED");
    }
  }
  redirect(`/admin/contents/${id}/edit?saved=1`);
}

export async function updateContentAction(id: number, fd: FormData) {
  await requireRole(["admin", "editor"]);
  const data = await parseForm(fd);
  await updateContent(id, data);
  await logAudit("contents", `"${data.title}" content updated`);
  revalidateTag("contents");
  const row = await getAdminContentById(id);
  if (row?.CatSeo) {
    const url = await buildContentUrl(row.CatSeo, data.seo);
    if (isLive(data.isActive, data.publishDate)) {
      submitIndexingFireAndForget(id, url, "URL_UPDATED");
    } else if (!data.isActive) {
      // Editor flipped the piece off / soft-unpublished — tell Google to drop it.
      submitIndexingFireAndForget(id, url, "URL_DELETED");
    }
    // Else: active but scheduled in the future → skip; the activator will
    // ping URL_UPDATED when PublishDate <= NOW().
  }
  redirect(`/admin/contents/${id}/edit?saved=1`);
}

export async function deleteContentAction(fd: FormData) {
  await requireRole(["admin"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) return;
  const row = await getAdminContentById(id);
  await softDeleteContent(id);
  await logAudit("contents", `"${row?.ContentTitle ?? `#${id}`}" content deleted`);
  revalidateTag("contents");
  if (row?.ContentSeo && row?.CatSeo) {
    const url = await buildContentUrl(row.CatSeo, row.ContentSeo);
    submitIndexingFireAndForget(id, url, "URL_DELETED");
  }
  redirect("/admin/contents?deleted=1");
}

export async function toggleContentAction(fd: FormData) {
  await requireRole(["admin", "editor"]);
  const id = Number(fd.get("id"));
  const active = fd.get("active") === "true";
  if (!Number.isFinite(id)) return;
  await toggleContentActive(id, active);
  revalidateTag("contents");
  const row = await getAdminContentById(id);
  await logAudit(
    "contents",
    `"${row?.ContentTitle ?? `#${id}`}" content ${active ? "published" : "unpublished"}`
  );
  if (row?.ContentSeo && row?.CatSeo) {
    const url = await buildContentUrl(row.CatSeo, row.ContentSeo);
    if (!active) {
      submitIndexingFireAndForget(id, url, "URL_DELETED");
    } else {
      // Don't ping Google for a scheduled-future row; the activator will
      // submit URL_UPDATED when the PublishDate moment arrives.
      const publish = row.PublishDate ? new Date(row.PublishDate) : new Date();
      if (publish.getTime() <= Date.now()) {
        submitIndexingFireAndForget(id, url, "URL_UPDATED");
      }
    }
  }
  redirect("/admin/contents");
}
