import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/admin/rate-limit";
import { getVersionStatus } from "@/lib/system/version";
import { getJob, startUpdateJob, isUpdaterEnabled } from "@/lib/system/update-job";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    return NextResponse.json(
      { error: m === "FORBIDDEN" ? "forbidden" : "unauthorized" },
      { status: m === "FORBIDDEN" ? 403 : 401 },
    );
  }
  return NextResponse.json({ enabled: isUpdaterEnabled(), job: getJob() });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireRole(["admin"]);
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    return NextResponse.json(
      { error: m === "FORBIDDEN" ? "forbidden" : "unauthorized" },
      { status: m === "FORBIDDEN" ? 403 : 401 },
    );
  }

  // One update attempt per hour per admin. Updates are heavy and irreversible
  // mid-flight; refuse rapid retries.
  const limit = checkRateLimit(`system-update:${session.uid}`, 2, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  let body: { tag?: unknown } = {};
  try {
    body = (await req.json()) as { tag?: unknown };
  } catch {
    /* no body — we'll resolve the target tag from the release feed */
  }

  const status = await getVersionStatus({ force: true });
  if (!status.latest) {
    return NextResponse.json({ error: "no_release" }, { status: 400 });
  }

  // Optional explicit tag for safety — must match the latest known tag,
  // otherwise the client and server disagree about what's being installed.
  if (typeof body.tag === "string" && body.tag !== status.latest.tag) {
    return NextResponse.json({ error: "tag_mismatch", latest: status.latest.tag }, { status: 409 });
  }

  if (!status.hasUpdate) {
    return NextResponse.json({ error: "already_up_to_date" }, { status: 400 });
  }

  const started = startUpdateJob({ tag: status.latest.tag, toVersion: status.latest.version });
  if (!started.ok) {
    return NextResponse.json({ error: started.error }, { status: 409 });
  }

  await logAudit("system", `update started: v${status.current} → ${status.latest.tag}`);

  return NextResponse.json({ job: started.job });
}
