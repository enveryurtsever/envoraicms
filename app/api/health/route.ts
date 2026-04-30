import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql<{ ok: number }[]>`SELECT 1 AS ok`;
    const ok = rows[0]?.ok === 1;
    return Response.json(
      { status: ok ? "ok" : "degraded", db: ok, ts: new Date().toISOString() },
      { status: ok ? 200 : 503 }
    );
  } catch (err) {
    return Response.json(
      { status: "error", db: false, error: (err as Error).message, ts: new Date().toISOString() },
      { status: 503 }
    );
  }
}
