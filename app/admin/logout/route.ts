import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Relative Location header. Building an absolute URL via `new URL(..., request.url)`
// breaks behind reverse proxies because request.url carries the upstream
// (http://localhost:PORT/...) host, producing redirects to localhost.

export async function GET() {
  await logAudit("auth", "signed out");
  await clearSession();
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/admin/login" },
  });
}

export async function POST() {
  return GET();
}
