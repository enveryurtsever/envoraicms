import { NextResponse, type NextRequest } from "next/server";
import { queueView } from "@/lib/views/buffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let id: number | null = null;
  try {
    const body = await req.json();
    const raw = Number(body?.id);
    if (Number.isFinite(raw) && raw > 0) id = raw;
  } catch {
    /* ignore — beacon'lar bazen body parse edilmez */
  }
  if (id === null) return new NextResponse(null, { status: 204 });
  queueView(id);
  return new NextResponse(null, { status: 204 });
}
