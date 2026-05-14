import "server-only";
import { sql } from "@/lib/db";

// In-process scheduler. Started from instrumentation.ts on Next.js boot.
// Ticks every 60s; on each tick runs every cron job whose NextRunAt has
// elapsed. Designed to work for both `npm run dev` (Mac) and `npm start`
// (Ubuntu) without any external scheduler. Disable with SCHEDULER_DISABLED=1.

declare global {
  // eslint-disable-next-line no-var
  var __envoraSchedulerStarted: boolean | undefined;
}

const TICK_INTERVAL_MS = 60_000;
// First tick is delayed so server boot is not blocked by job execution.
const INITIAL_DELAY_MS = 5_000;
// Arbitrary 32-bit advisory-lock key — `pgcron` letters as int32. Used to
// serialize ticks across multi-worker deploys: only one worker actually
// processes due jobs; the others fast-skip.
const SCHEDULER_LOCK_KEY = 0x70670901;

let ticking = false;

export function startScheduler(): void {
  if (process.env.SCHEDULER_DISABLED === "1") {
    console.log("[scheduler] disabled via SCHEDULER_DISABLED=1");
    return;
  }
  // The Next.js dev server reuses the same Node process across HMR; without
  // this guard, each rebuild stacks another setInterval.
  if (global.__envoraSchedulerStarted) return;
  global.__envoraSchedulerStarted = true;

  console.log(
    `[scheduler] in-process tick every ${TICK_INTERVAL_MS / 1000}s ` +
      `(set SCHEDULER_DISABLED=1 to turn off)`,
  );

  setTimeout(() => void tick(), INITIAL_DELAY_MS);
  setInterval(() => void tick(), TICK_INTERVAL_MS).unref?.();
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    // Cluster-safe: the first worker to grab the lock runs the batch; others
    // skip silently. The lock is released at the end of the tick.
    const got = await sql<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(${SCHEDULER_LOCK_KEY}) AS ok
    `;
    if (!got[0]?.ok) return;
    try {
      const [{ runDueCronJobs }, { activateScheduledArticles, drainPendingArticleQueues }] =
        await Promise.all([
          import("@/lib/ingest/run-due-jobs"),
          import("@/lib/ingest/activator"),
        ]);
      // 1) Activator: cheap UPDATE+RETURNING that surfaces any articles
      //    whose scheduled publish moment has arrived in the last minute,
      //    even if no cron job is due.
      try {
        await activateScheduledArticles();
      } catch (e) {
        console.error("[scheduler] activator failed:", e);
      }
      // 2) Drain pending article drafts — refill stays bound to the cron
      //    schedule, but expansion of staged drafts runs every tick so a
      //    daily cron doesn't gate hourly publish slots.
      try {
        await drainPendingArticleQueues();
      } catch (e) {
        console.error("[scheduler] drain failed:", e);
      }
      // 3) Cron-due jobs (refill for article kind, full pipeline for news).
      await runDueCronJobs();
    } finally {
      await sql`SELECT pg_advisory_unlock(${SCHEDULER_LOCK_KEY})`;
    }
  } catch (e) {
    console.error("[scheduler] tick failed:", e);
  } finally {
    ticking = false;
  }
}
