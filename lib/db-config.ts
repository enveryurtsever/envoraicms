/**
 * Single-source env reader. WordPress-style four fields (DB_HOST,
 * DB_NAME, DB_USER, DB_PASSWORD); also keeps DATABASE_URL fallback for
 * older deployments. Special characters in passwords no longer need URL
 * encoding.
 *
 * This file is imported from both the Next runtime (server-only) and the
 * tsx-run install scripts, so it deliberately isn't marked server-only.
 */

import type { Options } from "postgres";

export type DbConfig =
  | { kind: "url"; url: string }
  | {
      kind: "fields";
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl: "require" | "disable";
    };

export function getDbConfig(): DbConfig | null {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return { kind: "url", url };

  const host = process.env.DB_HOST?.trim();
  const database = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;
  if (!host || !database || !user || password === undefined) return null;

  const portRaw = process.env.DB_PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 5432;
  const sslRaw = process.env.DB_SSL?.trim().toLowerCase();
  const ssl: "require" | "disable" = sslRaw === "require" ? "require" : "disable";

  return { kind: "fields", host, port, database, user, password, ssl };
}

export function hasDbConfig(): boolean {
  return getDbConfig() !== null;
}

export function requireDbConfig(): DbConfig {
  const cfg = getDbConfig();
  if (cfg) return cfg;
  const missing: string[] = [];
  if (!process.env.DB_HOST) missing.push("DB_HOST");
  if (!process.env.DB_NAME) missing.push("DB_NAME");
  if (!process.env.DB_USER) missing.push("DB_USER");
  if (process.env.DB_PASSWORD === undefined) missing.push("DB_PASSWORD");
  throw new Error(
    `Database config missing in .env.local: ${missing.join(", ") || "DATABASE_URL or DB_*"}. ` +
      "Edit .env.local and restart.",
  );
}

type PostgresFn = <T extends readonly unknown[] = readonly unknown[]>(
  ...args: unknown[]
) => unknown;

/**
 * Single source for the arguments passed to postgres(...).
 * Works for both the URL form and the separate-fields form.
 */
export function buildPostgresArgs(
  cfg: DbConfig,
  extra: Options<Record<string, never>> = {},
): [string, Options<Record<string, never>>] | [Options<Record<string, never>>] {
  if (cfg.kind === "url") {
    return [cfg.url, { ...extra }];
  }
  return [
    {
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      username: cfg.user,
      password: cfg.password,
      ssl: cfg.ssl === "require" ? "require" : false,
      ...extra,
    },
  ];
}

// Type-safe wrapper: the postgres module's call signature is wide; this
// helper passes args via a generic instead of `as never`.
export function callPostgres<T extends PostgresFn>(
  postgresFn: T,
  cfg: DbConfig,
  extra: Options<Record<string, never>> = {},
): ReturnType<T> {
  const args = buildPostgresArgs(cfg, extra);
  return postgresFn(...args) as ReturnType<T>;
}
