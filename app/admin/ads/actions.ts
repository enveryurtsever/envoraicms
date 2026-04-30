"use server";

import { revalidateTag } from "next/cache";
import { getSession, requireRole } from "@/lib/auth/session";
import { upsertAdZone } from "@/lib/queries/adzones";
import { logAudit } from "@/lib/audit";

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveAdZoneAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const sess = await getSession();

  const slot = str(fd, "slot");
  if (!slot) throw new Error("Slot name is required.");

  const isActive = fd.get("isActive") === "on";
  await upsertAdZone(
    {
      slot,
      label: str(fd, "label"),
      htmlSnippet: str(fd, "htmlSnippet"),
      isActive,
      startsAt: parseDate(str(fd, "startsAt")),
      endsAt: parseDate(str(fd, "endsAt")),
      note: str(fd, "note"),
    },
    sess?.uid ?? null,
  );
  await logAudit(
    "ads",
    `"${slot}" ad slot updated (${isActive ? "active" : "inactive"})`
  );
  revalidateTag("adzones");
}
