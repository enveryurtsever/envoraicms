/**
 * One-shot tick. Picks up due CronJobs and runs them. Originally invoked by
 * a systemd timer every 10 minutes; now also runnable on demand. The same
 * tick logic is used in-process by lib/ingest/scheduler.ts when the Next.js
 * server is running, so external schedulers are optional.
 *
 * Run: npm run ingest:runner
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

import { sql } from "../lib/db";
import { runDueCronJobs } from "../lib/ingest/run-due-jobs";

runDueCronJobs()
  .catch((err) => {
    console.error("[runner][fatal]", err);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
