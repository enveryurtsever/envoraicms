import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await logAudit("auth", "signed out");
  await clearSession();
  const url = new URL("/admin/login", request.url);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  return GET(request);
}
