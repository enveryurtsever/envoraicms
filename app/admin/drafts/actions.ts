"use server";
import { revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { processPendingDrafts } from "@/lib/ingest/pipeline-newsnow";
import { resetDraftToPending, deleteDraft } from "@/lib/ingest/drafts";
import {
  resetArticleDraftToPending,
  deleteArticleDraft,
} from "@/lib/ingest/article-drafts";
import { logAudit } from "@/lib/audit";

export async function processPendingAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const limitRaw = Number(fd.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(50, limitRaw) : 5;
  const log: string[] = [];
  const outcome = await processPendingDrafts({ limit, log });
  await logAudit(
    "drafts",
    `processed ${outcome.inserted}/${outcome.skipped}/${outcome.errored} (insert/skip/error)`,
  );
  revalidateTag("drafts");
}

export async function retryDraftAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Invalid id.");
  await resetDraftToPending(id);
  await logAudit("drafts", `draft #${id} reset to pending`);
  revalidateTag("drafts");
}

export async function deleteDraftAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Invalid id.");
  await deleteDraft(id);
  await logAudit("drafts", `draft #${id} deleted`);
  revalidateTag("drafts");
}

export async function retryArticleDraftAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Invalid id.");
  await resetArticleDraftToPending(id);
  await logAudit("drafts", `article draft #${id} reset to pending`);
  revalidateTag("article-drafts");
}

export async function deleteArticleDraftAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Invalid id.");
  await deleteArticleDraft(id);
  await logAudit("drafts", `article draft #${id} deleted`);
  revalidateTag("article-drafts");
}
