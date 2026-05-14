import "server-only";
import postgres from "postgres";
import { requireDbConfig, buildPostgresArgs } from "./db-config";

// Lazy-init: don't crash on module load when env is missing; connect on first query.
// Required so the installer can boot.

declare global {
  // eslint-disable-next-line no-var
  var __sqlPool: ReturnType<typeof postgres> | undefined;
}

type Sql = ReturnType<typeof postgres>;

function buildPool(): Sql {
  const cfg = requireDbConfig();
  const args = buildPostgresArgs(cfg, {
    // Sized for concurrent web traffic + ingest pipelines running side-by-side.
    // Web requests stay sub-second; ingest jobs (rewrite/ideation/recent-titles
    // window functions) can take longer, hence the 15s statement_timeout below.
    max: 25,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: true,
    connection: { statement_timeout: 15000 },
    transform: { undefined: null },
    // PG TIMESTAMP WITHOUT TIME ZONE (OID 1114) is naive — postgres-js's
    // default parser feeds it to `new Date(...)`, which JS interprets in the
    // server's local TZ. We always store UTC, so force UTC parsing here.
    // Otherwise admins on non-UTC machines (Mac EDT, etc.) see publish
    // dates shifted by their offset.
    // postgres-js's Options generic narrows `types` to `never`; a local
    // cast is the lightest escape hatch.
    types: {
      timestamp: {
        to: 1114,
        from: [1114],
        serialize: (val: Date | string) =>
          val instanceof Date ? val.toISOString() : val,
        parse: (val: string) => new Date(val.replace(" ", "T") + "Z"),
      },
    } as never,
  });
  // postgres() iki overload kabul eder: (url, opts) ve (opts).
  // buildPostgresArgs already picked the right shape; we just spread it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (postgres as any)(...args);
}

function getPool(): Sql {
  if (global.__sqlPool) return global.__sqlPool;
  global.__sqlPool = buildPool();
  return global.__sqlPool;
}

export function resetPool(): void {
  if (global.__sqlPool) {
    try {
      void global.__sqlPool.end({ timeout: 2 });
    } catch {
      /* ignore */
    }
  }
  global.__sqlPool = undefined;
}

export const sql = new Proxy(
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  function () {} as unknown as Sql,
  {
    get(_t, prop, receiver) {
      const p = getPool();
      const v = Reflect.get(p as unknown as object, prop, receiver);
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(p) : v;
    },
    apply(_t, _thisArg, args) {
      const p = getPool();
      return (p as unknown as (...a: unknown[]) => unknown)(...args);
    },
  },
) as Sql;
