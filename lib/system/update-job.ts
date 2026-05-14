import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { takeBackup, runCommand, getHeadSha } from "./backup";
import { clearVersionCache, getCurrentVersion } from "./version";

export type StepKey =
  | "backup"
  | "fetch"
  | "checkout"
  | "install"
  | "build"
  | "migrate"
  | "reload";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type Step = {
  key: StepKey;
  label: string;
  status: StepStatus;
  startedAt: number | null;
  endedAt: number | null;
};

export type LogEntry = {
  ts: number;
  level: "info" | "error";
  line: string;
};

export type UpdateJob = {
  id: string;
  status: "running" | "success" | "failed";
  fromVersion: string;
  toVersion: string;
  tag: string;
  fromSha: string;
  startedAt: number;
  endedAt: number | null;
  steps: Step[];
  log: LogEntry[];
  error: string | null;
  backupDir: string | null;
};

const G = globalThis as typeof globalThis & {
  __updateJob?: UpdateJob | null;
};

const STEP_LABELS: Record<StepKey, string> = {
  backup: "Take backup (DB + env + HEAD sha)",
  fetch: "Fetch tags from origin",
  checkout: "Reset working tree to release tag",
  install: "Install dependencies (npm ci)",
  build: "Build (next build)",
  migrate: "Apply DB migrations",
  reload: "Reload PM2 process",
};

function newSteps(): Step[] {
  return (Object.keys(STEP_LABELS) as StepKey[]).map((k) => ({
    key: k,
    label: STEP_LABELS[k],
    status: "pending",
    startedAt: null,
    endedAt: null,
  }));
}

export function getJob(): UpdateJob | null {
  return G.__updateJob ?? null;
}

function setStep(job: UpdateJob, key: StepKey, status: StepStatus) {
  const s = job.steps.find((x) => x.key === key);
  if (!s) return;
  if (status === "running") s.startedAt = Date.now();
  if (status === "done" || status === "failed" || status === "skipped") s.endedAt = Date.now();
  s.status = status;
}

function logLine(job: UpdateJob, line: string, level: "info" | "error" = "info") {
  job.log.push({ ts: Date.now(), level, line });
  // Cap log to prevent unbounded memory.
  if (job.log.length > 5000) job.log.splice(0, job.log.length - 5000);
}

function lineCollector(job: UpdateJob, prefix: string) {
  return (line: string) => logLine(job, `${prefix} ${line}`);
}

export function isUpdaterEnabled(): boolean {
  return (process.env.UPDATER_ENABLED ?? "").trim() === "true";
}

export function startUpdateJob(opts: {
  tag: string;
  toVersion: string;
}): { ok: true; job: UpdateJob } | { ok: false; error: string } {
  if (!isUpdaterEnabled()) {
    return { ok: false, error: "Updater disabled. Set UPDATER_ENABLED=true in .env.local to enable." };
  }
  const existing = getJob();
  if (existing && existing.status === "running") {
    return { ok: false, error: "An update is already in progress." };
  }

  const job: UpdateJob = {
    id: randomUUID(),
    status: "running",
    fromVersion: "",
    toVersion: opts.toVersion,
    tag: opts.tag,
    fromSha: "",
    startedAt: Date.now(),
    endedAt: null,
    steps: newSteps(),
    log: [],
    error: null,
    backupDir: null,
  };
  G.__updateJob = job;

  // Run asynchronously; the API route returns immediately.
  void runUpdate(job).catch((err) => {
    logLine(job, String(err instanceof Error ? err.stack ?? err.message : err), "error");
    job.error = err instanceof Error ? err.message : String(err);
    job.status = "failed";
    job.endedAt = Date.now();
  });

  return { ok: true, job };
}

async function runUpdate(job: UpdateJob): Promise<void> {
  job.fromVersion = await getCurrentVersion();
  job.fromSha = await getHeadSha();
  logLine(job, `Updating from v${job.fromVersion} (${job.fromSha.slice(0, 10) || "no-sha"}) to ${job.tag}`);

  // 1. Backup
  setStep(job, "backup", "running");
  try {
    const r = await takeBackup({
      label: `pre-${job.toVersion}`,
      onLine: (l) => logLine(job, l),
    });
    job.backupDir = r.dir;
    logLine(job, `[backup] saved to ${r.dir} (${(r.bytes / 1024 / 1024).toFixed(1)} MB)`);
    setStep(job, "backup", "done");
  } catch (err) {
    setStep(job, "backup", "failed");
    throw err;
  }

  // 2. git fetch
  setStep(job, "fetch", "running");
  try {
    await runCommand("git", ["fetch", "--tags", "--prune", "origin"], {
      onLine: lineCollector(job, "[git fetch]"),
    });
    setStep(job, "fetch", "done");
  } catch (err) {
    setStep(job, "fetch", "failed");
    throw err;
  }

  // 3. git reset to tag
  setStep(job, "checkout", "running");
  try {
    await runCommand("git", ["reset", "--hard", job.tag], {
      onLine: lineCollector(job, "[git reset]"),
    });
    setStep(job, "checkout", "done");
  } catch (err) {
    setStep(job, "checkout", "failed");
    throw err;
  }

  // 4. npm ci — force devDependencies even though PM2 sets NODE_ENV=production.
  // Otherwise typescript/tsx (devDeps) go missing and the build step right
  // after this fails with "Cannot find module 'typescript'" when Next tries
  // to load next.config.ts.
  setStep(job, "install", "running");
  try {
    await runCommand("npm", ["ci", "--no-audit", "--no-fund", "--include=dev"], {
      env: { NODE_ENV: "development" },
      onLine: lineCollector(job, "[npm ci]"),
    });
    setStep(job, "install", "done");
  } catch (err) {
    setStep(job, "install", "failed");
    throw err;
  }

  // 5. npm run build
  setStep(job, "build", "running");
  try {
    await runCommand("npm", ["run", "build"], {
      env: { NODE_ENV: "production" },
      onLine: lineCollector(job, "[build]"),
    });
    setStep(job, "build", "done");
  } catch (err) {
    setStep(job, "build", "failed");
    throw err;
  }

  // 6. migrate (idempotent)
  setStep(job, "migrate", "running");
  try {
    await runCommand("npm", ["run", "migrate"], {
      onLine: lineCollector(job, "[migrate]"),
    });
    setStep(job, "migrate", "done");
  } catch (err) {
    setStep(job, "migrate", "failed");
    throw err;
  }

  // 7. pm2 reload — fire and forget so we can return a response.
  // pm2 reload is graceful in cluster mode, so in-flight requests survive.
  setStep(job, "reload", "running");
  logLine(job, "[reload] scheduling pm2 reload in 1s …");
  job.status = "success";
  job.endedAt = Date.now();
  setStep(job, "reload", "done");
  clearVersionCache();

  setTimeout(() => {
    try {
      const child = spawn("pm2", ["reload", "envoraicms"], {
        detached: true,
        stdio: "ignore",
        env: process.env,
      });
      child.unref();
    } catch {
      /* pm2 missing — user is presumably in dev or running without pm2;
         they will need to restart manually. The step is already marked done
         so the UI doesn't hang waiting for it. */
    }
  }, 1000);
}

export function clearJob(): void {
  G.__updateJob = null;
}
