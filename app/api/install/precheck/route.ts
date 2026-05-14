import { NextResponse } from "next/server";
import postgres from "postgres";
import { getDbConfig, buildPostgresArgs } from "@/lib/db-config";
import { isInstalled } from "@/lib/install/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called from the wizard's first step. Reads DB credentials from .env.local
// and runs SELECT 1; returns a friendly error if it can't connect.
// 10s timeout — don't keep the user waiting too long.

export async function GET() {
  if (await isInstalled()) {
    return NextResponse.json(
      { ok: false, error: "already_installed", message: "Installation is already complete." },
      { status: 409 },
    );
  }

  const cfg = getDbConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_db_config",
        message: "DB_HOST, DB_NAME, DB_USER, DB_PASSWORD missing in .env.local.",
      },
      { status: 400 },
    );
  }

  const args = buildPostgresArgs(cfg, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 1,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sql = (postgres as any)(...args) as ReturnType<typeof postgres>;
  try {
    const rows = await sql<{ ok: number }[]>`SELECT 1 AS ok`;
    if (rows[0]?.ok !== 1) throw new Error("unexpected response");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[install/precheck] db unreachable:", err);
    return NextResponse.json(
      { ok: false, error: "db_unreachable", message: "Could not connect to the database. Check DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD." },
      { status: 502 },
    );
  } finally {
    void sql.end({ timeout: 2 });
  }
}
