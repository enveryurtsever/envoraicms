import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getVersionStatus } from "@/lib/system/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["admin"]);
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    return NextResponse.json(
      { error: m === "FORBIDDEN" ? "forbidden" : "unauthorized" },
      { status: m === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const status = await getVersionStatus({ force });
  return NextResponse.json(status);
}
