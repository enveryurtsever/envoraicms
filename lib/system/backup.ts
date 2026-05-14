import "server-only";
import { spawn } from "node:child_process";
import { mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { getDbConfig } from "@/lib/db-config";

export type BackupResult = {
  dir: string;          // absolute path of the timestamped backup folder
  dbDump: string;       // absolute path of the pg_dump file
  envCopy: string | null;
  shaFile: string;      // absolute path of the saved commit SHA
  bytes: number;        // size of dbDump
};

const BACKUP_ROOT = join(process.cwd(), "backups");

function ts(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/** Run a command, resolving with stdout+stderr text. Rejects on non-zero exit.
 *  onLine streams output lines as they arrive (best-effort, line-buffered). */
export function runCommand(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; onLine?: (line: string) => void },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd ?? process.cwd(),
      env: { ...process.env, ...opts?.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let stdoutBuf = "";
    let stderrBuf = "";

    const flushLines = (chunk: string, isErr: boolean) => {
      const buf = (isErr ? stderrBuf : stdoutBuf) + chunk;
      const lines = buf.split("\n");
      const remainder = lines.pop() ?? "";
      if (isErr) stderrBuf = remainder;
      else stdoutBuf = remainder;
      for (const ln of lines) {
        if (ln.length === 0) continue;
        opts?.onLine?.(ln);
      }
    };

    child.stdout?.on("data", (b: Buffer) => {
      const s = b.toString("utf8");
      stdout += s;
      if (opts?.onLine) flushLines(s, false);
    });
    child.stderr?.on("data", (b: Buffer) => {
      const s = b.toString("utf8");
      stderr += s;
      if (opts?.onLine) flushLines(s, true);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (stdoutBuf && opts?.onLine) opts.onLine(stdoutBuf);
      if (stderrBuf && opts?.onLine) opts.onLine(stderrBuf);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

export async function ensureBackupDir(): Promise<string> {
  await mkdir(BACKUP_ROOT, { recursive: true });
  return BACKUP_ROOT;
}

/** Read the current HEAD commit. Used to record a rollback target. */
export async function getHeadSha(): Promise<string> {
  try {
    const { stdout } = await runCommand("git", ["rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return "";
  }
}

/** Snapshot DB + env + current SHA into ./backups/{ts}. Returns the folder. */
export async function takeBackup(opts?: {
  label?: string;
  onLine?: (line: string) => void;
}): Promise<BackupResult> {
  await ensureBackupDir();
  const stamp = ts();
  const label = opts?.label ? `-${opts.label}` : "";
  const dir = join(BACKUP_ROOT, `${stamp}${label}`);
  await mkdir(dir, { recursive: true });

  const dbDump = join(dir, "db.dump");
  const cfg = getDbConfig();
  if (!cfg) throw new Error("DB config missing — cannot pg_dump");

  const env: NodeJS.ProcessEnv = { ...process.env };
  const args: string[] = ["-Fc", "--no-owner", "--no-privileges"];
  if (cfg.kind === "url") {
    args.push("-d", cfg.url);
  } else {
    args.push(
      "-h", cfg.host,
      "-p", String(cfg.port),
      "-U", cfg.user,
      "-d", cfg.database,
    );
    env.PGPASSWORD = cfg.password;
  }
  args.push("-f", dbDump);

  opts?.onLine?.(`[backup] pg_dump → ${dbDump}`);
  await runCommand("pg_dump", args, { env, onLine: opts?.onLine });

  // Snapshot .env.local if present
  let envCopy: string | null = null;
  const envSrc = join(process.cwd(), ".env.local");
  try {
    await stat(envSrc);
    envCopy = join(dir, ".env.local");
    await copyFile(envSrc, envCopy);
    opts?.onLine?.(`[backup] copied .env.local`);
  } catch {
    /* .env.local missing — fine, may be using process env */
  }

  const sha = await getHeadSha();
  const shaFile = join(dir, "git-head.txt");
  await writeFile(shaFile, sha + "\n", "utf8");
  opts?.onLine?.(`[backup] recorded HEAD: ${sha.slice(0, 10) || "(unknown)"}`);

  const dumpStat = await stat(dbDump);
  return { dir, dbDump, envCopy, shaFile, bytes: dumpStat.size };
}
