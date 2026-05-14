// Next.js boot hook (https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
// Node-only side is in instrumentation-node.ts; the `=== "nodejs"` shape is
// what Next's webpack pass relies on to dead-code-eliminate the import for
// the edge bundle (so native deps like postgres / sharp don't get followed).

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // `next build` boots a transient server during page-data collection;
    // starting the scheduler there breaks the export step and does no work
    // we'd want anyway. Only run on the dev/prod server processes.
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    if (!process.env.DATABASE_URL && !process.env.DB_HOST) return;
    await import("./instrumentation-node");
  }
}
