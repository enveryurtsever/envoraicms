// Node-runtime-only side of instrumentation. Importing the scheduler from
// here (instead of from instrumentation.ts directly) keeps native deps like
// sharp out of the edge bundle.

import { startScheduler } from "@/lib/ingest/scheduler";

startScheduler();
