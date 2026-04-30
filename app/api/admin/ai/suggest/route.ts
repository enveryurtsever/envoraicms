import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { isSuggestField, suggestField } from "@/lib/ingest/ai/suggest";
import { checkRateLimit } from "@/lib/admin/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const limit = checkRateLimit(`ai-suggest:${session.uid}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const payload = body as { field?: unknown; context?: unknown };
  if (!isSuggestField(payload.field)) {
    return NextResponse.json({ error: "invalid_field" }, { status: 400 });
  }

  const ctx: Record<string, string> = {};
  if (payload.context && typeof payload.context === "object" && !Array.isArray(payload.context)) {
    for (const [k, v] of Object.entries(payload.context as Record<string, unknown>)) {
      if (typeof v === "string") ctx[k] = v;
    }
  }

  try {
    const suggestion = await suggestField(payload.field, ctx);
    return NextResponse.json({ suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const isConfig = message.startsWith("No active ApiKey");
    return NextResponse.json(
      { error: isConfig ? "no_api_key" : "ai_error", message },
      { status: isConfig ? 409 : 502 },
    );
  }
}
