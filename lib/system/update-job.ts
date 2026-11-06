import "server-only";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { takeBackup, runCommand, getHeadSha, GIT_SAFE_DIR_ARGS } from "./backup";
import { clearVersionCache, getCurrentVersion } from "./version";
import { findOwnPm2, scheduleReload } from "./pm2-reload";

/** PM2 app name to reload. Mirrors the resolution order in
 *  deploy/ecosystem.config.js so the updater drives whatever name PM2 is
 *  actually using. PM2_APP_NAME is forwarded into the child by the
 *  ecosystem config, so this read is reliable when running under PM2. */
function pm2AppName(): string {
  const explicit = (process.env.PM2_APP_NAME ?? "").trim();
  if (explicit) return explicit;
  const url = (process.env.SITE_URL ?? "").trim();
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host && host !== "localhost") return host;
    } catch {
      /* malformed URL — fall through */
    }
  }
  return "envoraicms";
}

export type StepKey =
  | "backup"
  | "fetch"
  | "checkout"
  | "install"
  | "migrate"
  | "build"
  | "reload"
  /** Only appended to job.steps when an update fails and the auto-rollback
   *  procedure kicks in. Never present in a successful run. */
  | "rollback";

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
  /** PM2 app name derived at job start. Persisted on the job so the client-
   *  side error banner can render an accurate manual-recovery command line
   *  (`pm2 reload <name>`) without re-deriving it in the browser. */
  pm2AppName: string;
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
  migrate: "Apply DB migrations",
  build: "Build (next build)",
  reload: "Reload PM2 process",
  rollback: "Auto-rollback to previous version",
};

// Steps shown up-front when an update starts. "rollback" is intentionally
// omitted — it's appended dynamically iff a failure triggers recovery, so
// the happy-path UI doesn't show a confusing "pending rollback" row.
const HAPPY_PATH_STEPS: StepKey[] = [
  "backup",
  "fetch",
  "checkout",
  "install",
  "migrate",
  "build",
  "reload",
];

function newSteps(): Step[] {
  return HAPPY_PATH_STEPS.map((k) => ({
    key: k,
    label: STEP_LABELS[k],
    status: "pending",
    startedAt: null,
    endedAt: null,
  }));
}

function appendStep(job: UpdateJob, key: StepKey): Step {
  const step: Step = {
    key,
    label: STEP_LABELS[key],
    status: "pending",
    startedAt: null,
    endedAt: null,
  };
  job.steps.push(step);
  return step;
}

// Each PM2 worker has its own memory and the worker running an update is
// replaced at the end of it, so job state also lives in a file every worker can
// read. Without this, the update screen stays on "in progress" forever.
const JOB_FILE = join(process.cwd(), "backups", "update-job.json");
const JOB_SAVE_MS = 1000;
const JOB_STALE_MS = 2 * 60_000;
const FINISHED_JOB_VISIBLE_MS = 60 * 60_000;
const SAVED_LOG_LINES = 1000;

function saveJob(job: UpdateJob): void {
  try {
    mkdirSync(join(process.cwd(), "backups"), { recursive: true });
    const temp = `${JOB_FILE}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify({ ...job, log: job.log.slice(-SAVED_LOG_LINES) }));
    renameSync(temp, JOB_FILE);
  } catch {
    // Progress display only; the update itself carries on.
  }
}

function readSavedJob(): UpdateJob | null {
  try {
    const job = JSON.parse(readFileSync(JOB_FILE, "utf8")) as UpdateJob;
    if (job.status === "running" && Date.now() - statSync(JOB_FILE).mtimeMs > JOB_STALE_MS) {
      // The worker running it would still be saving, so it must have died.
      return {
        ...job,
        status: "failed",
        error: "The update stopped unexpectedly. Check the site version and the PM2 logs on the server.",
      };
    }
    return job;
  } catch {
    return null;
  }
}

export function getJob(): UpdateJob | null {
  const own = G.__updateJob;
  if (own?.status === "running") return own;
  const job = readSavedJob() ?? own ?? null;
  if (job?.endedAt && Date.now() - job.endedAt > FINISHED_JOB_VISIBLE_MS) return null;
  return job;
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
    pm2AppName: pm2AppName(),
    startedAt: Date.now(),
    endedAt: null,
    steps: newSteps(),
    log: [],
    error: null,
    backupDir: null,
  };
  G.__updateJob = job;
  saveJob(job);
  const saving = setInterval(() => saveJob(job), JOB_SAVE_MS);

  // Run asynchronously; the API route returns immediately.
  void runUpdate(job).catch(async (err) => {
    logLine(job, String(err instanceof Error ? err.stack ?? err.message : err), "error");
    job.error = err instanceof Error ? err.message : String(err);
    // Keep status "running" through the rollback so the UI's polling loop
    // (which stops on success/failed) keeps streaming rollback progress.
    // Try to recover code to the pre-update commit. DB migrations are left
    // in place (schema.sql is purely additive, so the old code tolerates
    // extra columns it doesn't read).
    await attemptRollback(job).catch((rbErr) => {
      logLine(
        job,
        `[rollback] internal error: ${rbErr instanceof Error ? rbErr.message : String(rbErr)}`,
        "error",
      );
    });
    job.status = "failed";
    job.endedAt = Date.now();
  }).finally(() => {
    clearInterval(saving);
    saveJob(job);
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
    await runCommand("git", [...GIT_SAFE_DIR_ARGS, "fetch", "--tags", "--prune", "origin"], {
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
    await runCommand("git", [...GIT_SAFE_DIR_ARGS, "reset", "--hard", job.tag], {
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

  // 5. migrate (idempotent) — MUST run before build. `next build` prerenders
  // static routes that hit getSettings() and similar queries; if a release
  // adds a new column, the build SELECT will explode with "column does not
  // exist" unless the schema is already up-to-date. Schema.sql is purely
  // additive (CREATE / ALTER ... IF NOT EXISTS), so running it ahead of the
  // build is safe — old code on the previous .next/ tolerates new columns.
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

  // 6. npm run build
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

  // 7. pm2 reload. Graceful in cluster mode, so in-flight requests survive.
  // The new code is already built, so a failure here doesn't roll back: the
  // site only needs a reload.
  setStep(job, "reload", "running");
  clearVersionCache();
  const own = await findOwnPm2();
  if (!own) {
    const message = `The update is installed, but no PM2 process was found for this folder, so the site is still running the old version. Run "pm2 reload ${job.pm2AppName}" on the server.`;
    logLine(job, `[reload] ${message}`, "error");
    setStep(job, "reload", "failed");
    job.error = message;
    job.status = "failed";
    job.endedAt = Date.now();
    return;
  }
  job.pm2AppName = own.name;
  const logFile = scheduleReload(own);
  logLine(job, `[reload] reloading ${own.name} (PM2 ids ${own.ids.join(", ")}). Output: ${logFile}`);
  setStep(job, "reload", "done");
  job.status = "success";
  job.endedAt = Date.now();
}

/** Auto-rollback procedure invoked when any update step throws. Restores
 *  the working tree to the pre-update commit, reinstalls and rebuilds the
 *  old code, then schedules a pm2 reload. DB is intentionally left alone:
 *  schema.sql is purely additive (CREATE / ALTER ... IF NOT EXISTS), so
 *  the old code tolerates whatever migrations had already applied. The
 *  pre-update DB dump is still in `backupDir` if the operator wants to
 *  restore it manually.
 *
 *  The function never throws — rollback failures are logged so the UI can
 *  surface them, and the operator can fall back to the manual recovery
 *  commands printed at the bottom of the log. */
async function attemptRollback(job: UpdateJob): Promise<void> {
  const step = appendStep(job, "rollback");
  step.status = "running";
  step.startedAt = Date.now();

  const finish = (status: StepStatus) => {
    step.status = status;
    step.endedAt = Date.now();
  };

  if (!job.fromSha) {
    logLine(
      job,
      `[rollback] no pre-update SHA recorded — cannot auto-rollback. ` +
        `Manual: cd to install dir, find your previous version in git log, run "git reset --hard <sha>", "npm ci --include=dev", "npm run build", "pm2 reload ${pm2AppName()}".`,
      "error",
    );
    finish("failed");
    return;
  }

  logLine(
    job,
    `[rollback] restoring code to ${job.fromSha.slice(0, 10)} (v${job.fromVersion || "?"})`,
  );

  try {
    await runCommand("git", [...GIT_SAFE_DIR_ARGS, "reset", "--hard", job.fromSha], {
      onLine: lineCollector(job, "[rollback git]"),
    });
    await runCommand(
      "npm",
      ["ci", "--no-audit", "--no-fund", "--include=dev"],
      {
        env: { NODE_ENV: "development" },
        onLine: lineCollector(job, "[rollback npm ci]"),
      },
    );
    await runCommand("npm", ["run", "build"], {
      env: { NODE_ENV: "production" },
      onLine: lineCollector(job, "[rollback build]"),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logLine(job, `[rollback] FAILED: ${msg}`, "error");
    logLine(
      job,
      `[rollback] Manual recovery: cd to install dir, run "git reset --hard ${job.fromSha}", "npm ci --include=dev", "npm run build", "pm2 reload ${pm2AppName()}". DB backup is at ${job.backupDir ?? "(see backups/ folder)"}.`,
      "error",
    );
    finish("failed");
    return;
  }

  clearVersionCache();
  const own = await findOwnPm2();
  if (!own) {
    logLine(
      job,
      `[rollback] code restored, but no PM2 process was found for this folder. Run "pm2 reload ${job.pm2AppName}" on the server.`,
      "error",
    );
    finish("failed");
    return;
  }
  job.pm2AppName = own.name;
  scheduleReload(own);
  logLine(job, `[rollback] code restored; reloading ${own.name} (PM2 ids ${own.ids.join(", ")})`);
  finish("done");
}

export function clearJob(): void {
  G.__updateJob = null;
  rmSync(JOB_FILE, { force: true });
}
