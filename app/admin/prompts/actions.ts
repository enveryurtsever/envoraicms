"use server";

import { revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { findDefault, resetPromptToDefault, upsertPrompt } from "@/lib/queries/prompts";
import { logAudit } from "@/lib/audit";

function str(fd: FormData, k: string, max = 20000): string {
  const v = fd.get(k);
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function savePromptAction(fd: FormData): Promise<void> {
  const session = await requireRole(["admin"]);
  const key = str(fd, "key", 64);
  if (!key) throw new Error("Prompt key missing.");

  const label = str(fd, "label", 120) || findDefault(key)?.label || key;
  const description = str(fd, "description", 500);
  const template = str(fd, "template", 20000);
  if (template.length < 20) {
    throw new Error("Template is too short (at least 20 characters).");
  }

  await upsertPrompt(key, label, description, template, session.uid);
  await logAudit("prompts", `"${key}" prompt updated`);
  revalidateTag("prompts");
}

export async function resetPromptAction(fd: FormData): Promise<void> {
  const session = await requireRole(["admin"]);
  const key = str(fd, "key", 64);
  if (!key) throw new Error("Prompt key missing.");
  const ok = await resetPromptToDefault(key, session.uid);
  if (!ok) throw new Error("This prompt has no built-in default.");
  await logAudit("prompts", `"${key}" prompt reset to default`);
  revalidateTag("prompts");
}
