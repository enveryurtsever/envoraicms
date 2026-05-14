import { NextResponse, type NextRequest } from "next/server";
import { queueView } from "@/lib/views/buffer";
import { checkRateLimit } from "@/lib/admin/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 204 });

  let id: number | null = null;
  try {
    const body = await req.json();
    const raw = Number(body?.id);
    if (Number.isFinite(raw) && raw > 0 && Number.isInteger(raw)) id = raw;
  } catch {
    /* ignore — beacon'lar bazen body parse edilmez */
  }
  if (id === null) return new NextResponse(null, { status: 204 });

  const ip = clientIp(req);
  // Per (ip, contentId): 1 view / 30 minutes — legitimate re-reads still work, abuse can't inflate.
  const perPair = checkRateLimit(`view:${ip}:${id}`, 1, 30 * 60_000);
  if (!perPair.ok) return new NextResponse(null, { status: 204 });
  // Per ip global cap: 120 distinct views / minute — kills enumeration floods.
  const perIp = checkRateLimit(`view-ip:${ip}`, 120, 60_000);
  if (!perIp.ok) return new NextResponse(null, { status: 204 });

  queueView(id);
  return new NextResponse(null, { status: 204 });
}
