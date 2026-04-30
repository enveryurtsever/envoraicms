"use server";
import { revalidateTag } from "next/cache";
import { getSession, requireRole } from "@/lib/auth/session";
import {
  createApiKey,
  setApiKeyActive,
  softDeleteApiKey,
} from "@/lib/queries/apikeys";
import type { ApiKeyPurpose } from "@/lib/types";
import { logAudit } from "@/lib/audit";

const PURPOSES: readonly ApiKeyPurpose[] = [
  "news_source",
  "trends_source",
  "text_ai",
  "image_ai",
];

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    throw new Error("Config must be valid JSON.");
  }
}

export async function createApiKeyAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const sess = await getSession();

  const provider = str(fd, "Provider");
  const purposeRaw = str(fd, "Purpose");
  const plaintext = str(fd, "KeyValue");
  if (!provider) throw new Error("Provider is required.");
  if (!purposeRaw) throw new Error("Purpose is required.");
  if (!plaintext) throw new Error("Key value is required.");
  if (!PURPOSES.includes(purposeRaw as ApiKeyPurpose)) {
    throw new Error("Invalid purpose.");
  }

  await createApiKey({
    provider,
    purpose: purposeRaw as ApiKeyPurpose,
    label: str(fd, "Label"),
    plaintext,
    config: parseConfig(str(fd, "Config")),
    isActive: fd.get("IsActive") === "on",
    creatorId: sess?.uid ?? null,
  });
  await logAudit("apikeys", `${provider} (${purposeRaw}) key added`);
  revalidateTag("apikeys");
}

export async function toggleApiKeyAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = Number(fd.get("id"));
  const active = fd.get("active") === "1";
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  await setApiKeyActive(id, active);
  await logAudit("apikeys", `#${id} key ${active ? "activated" : "deactivated"}`);
  revalidateTag("apikeys");
}

export async function deleteApiKeyAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  await softDeleteApiKey(id);
  await logAudit("apikeys", `#${id} key deleted`);
  revalidateTag("apikeys");
}
