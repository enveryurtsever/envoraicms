import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

export type OwnPm2 = { bin: string; ids: number[]; name: string };

function pm2Candidates(): string[] {
  // A server started by systemd may not have pm2 on PATH, and under nvm it
  // sits next to the node binary.
  const candidates = [
    "pm2",
    join(dirname(process.execPath), "pm2"),
    "/usr/local/bin/pm2",
    "/usr/bin/pm2",
  ];
  return candidates.filter((c) => c === "pm2" || existsSync(c));
}

// PM2 may have been started through a symlinked path.
function realPath(path: string | undefined): string | null {
  if (!path) return null;
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function jlist(bin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      ["jlist"],
      { timeout: 20_000, maxBuffer: 50 * 1024 * 1024, env: process.env },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

/** Finds this site's PM2 processes by install folder, because a name can be
 *  shared or differ from the one SITE_URL suggests. Other sites on the server
 *  run from other folders, so they are never included. Falls back to the name
 *  PM2 gave this process. Null when none is found. */
export async function findOwnPm2(cwd = process.cwd()): Promise<OwnPm2 | null> {
  for (const bin of pm2Candidates()) {
    try {
      const output = await jlist(bin);
      const apps = JSON.parse(output.slice(output.indexOf("["))) as {
        pm_id: number;
        name: string;
        pm2_env?: { pm_cwd?: string };
      }[];
      const folder = realPath(cwd);
      let own = apps.filter((app) => realPath(app.pm2_env?.pm_cwd) === folder);
      if (own.length === 0 && process.env.name) {
        own = apps.filter((app) => app.name === process.env.name);
      }
      if (own.length > 0) {
        return { bin, ids: own.map((app) => app.pm_id), name: own[0]!.name };
      }
    } catch {
      // Try the next location.
    }
  }
  return null;
}

/** Reloads the processes one at a time after a short delay. PM2 kills a worker's
 *  child processes along with it, which would stop a directly spawned reload
 *  partway and leave the other workers on the old code. The trailing `&` makes
 *  the shell exit at once, so the reload is no longer this worker's child. */
export function scheduleReload(own: OwnPm2, cwd = process.cwd()): string {
  const logDir = join(cwd, "backups");
  mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, "last-reload.log");
  const reloads = own.ids.map((id) => `"$PM2_RELOAD_BIN" reload ${Number(id)}`).join("; ");
  const script = `nohup sh -c 'sleep 1; date; ${reloads}; echo finished' > "$PM2_RELOAD_LOG" 2>&1 &`;
  const child = spawn("sh", ["-c", script], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, PM2_RELOAD_BIN: own.bin, PM2_RELOAD_LOG: logFile },
  });
  child.on("error", () => undefined);
  child.unref();
  return logFile;
}
