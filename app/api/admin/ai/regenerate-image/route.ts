import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/admin/rate-limit";
import { sql } from "@/lib/db";
import { makeFalaiProvider } from "@/lib/ingest/providers/image/falai";
import { getActiveApiKey } from "@/lib/queries/apikeys";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContentRow = {
  ContentID: number;
  ContentSeo: string;
  ImagePrompt: string | null;
};

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireRole(["admin", "editor"]);
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    return NextResponse.json(
      { error: m === "FORBIDDEN" ? "forbidden" : "unauthorized" },
      { status: m === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const limit = checkRateLimit(`ai-image:${session.uid}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  let body: { contentId?: unknown; prompt?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const contentId = Number(body.contentId);
  if (!Number.isFinite(contentId) || contentId <= 0) {
    return NextResponse.json({ error: "invalid_content_id" }, { status: 400 });
  }
  const promptOverride =
    typeof body.prompt === "string" && body.prompt.trim().length >= 8
      ? body.prompt.trim()
      : null;

  const rows = await sql<ContentRow[]>`
    SELECT "ContentID", "ContentSeo", "ImagePrompt"
    FROM "Contents"
    WHERE "ContentID" = ${contentId} AND "IsDeleted" = FALSE
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const prompt = promptOverride ?? row.ImagePrompt ?? "";
  if (prompt.trim().length < 8) {
    return NextResponse.json(
      { error: "prompt_missing", message: "Prompt is empty. Fill in the 'Image AI prompt' field first." },
      { status: 400 },
    );
  }

  const activeKey = await getActiveApiKey("falai", "image_ai");
  if (!activeKey) {
    return NextResponse.json(
      { error: "no_api_key", message: "No active fal.ai (image_ai) key. Add one in /admin/apikeys." },
      { status: 409 },
    );
  }

  try {
    const provider = await makeFalaiProvider();
    const path = await provider.generate({ prompt, slug: row.ContentSeo });
    await sql`
      UPDATE "Contents"
      SET "ContentImage" = ${path}, "ImagePrompt" = ${prompt}, "ModifiedDate" = NOW()
      WHERE "ContentID" = ${contentId}
    `;
    revalidateTag("contents");
    revalidateTag(`content:slug:${row.ContentSeo}`);
    await logAudit("contents", `"${row.ContentSeo}" regenerated the image`);
    return NextResponse.json({
      imageUrl: path,
      cacheBust: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: "generation_failed", message }, { status: 502 });
  }
}
