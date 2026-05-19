// PM2 process config. Run with `pm2 start deploy/ecosystem.config.js`.
//
// The PM2 app name is derived in this order (first non-empty wins):
//   1. PM2_APP_NAME env var (explicit override)
//   2. SITE_URL hostname (strips leading "www.")
//   3. "envoraicms" — last-resort fallback
//
// Why: a single host can run multiple Envoraicms installs side-by-side
// (techawave.com, foo.com, …). Naming each PM2 process after its domain
// keeps `pm2 list` and the in-app updater's `pm2 reload <name>` call
// pointed at the right one. PM2_APP_NAME is also exported into the child
// process so the in-app updater (lib/system/update-job.ts) reloads the
// correct app even when the operator never edited this file by hand.

const fs = require("node:fs");
const path = require("node:path");

function readEnvLocal() {
  const out = {};
  try {
    const file = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      let v = m[2];
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  } catch {
    /* missing — fine, fall back to process.env */
  }
  return out;
}

const localEnv = readEnvLocal();
const env = { ...localEnv, ...process.env };

function deriveAppName() {
  const explicit = (env.PM2_APP_NAME || "").trim();
  if (explicit) return explicit;
  const url = (env.SITE_URL || "").trim();
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host && host !== "localhost") return host;
    } catch {
      /* malformed URL — fall through to default */
    }
  }
  return "envoraicms";
}

const name = deriveAppName();
const port = Number(env.PORT) || 3000;

module.exports = {
  apps: [
    {
      name,
      cwd: process.cwd(),
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${port}`,
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: String(port),
        // Forward into the child so update-job.ts can recover the right
        // PM2 process name during an in-app reload.
        PM2_APP_NAME: name,
      },
      error_file: `/var/log/pm2/${name}-err.log`,
      out_file: `/var/log/pm2/${name}-out.log`,
      merge_logs: true,
      time: true,
    },
  ],
};
