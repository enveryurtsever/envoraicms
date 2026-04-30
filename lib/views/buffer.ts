import "server-only";
import { sql } from "@/lib/db";

// Low-cost view counter:
// - Don't write to the DB per view; accumulate in an in-memory Map.
// - Flush every 30s, or when the buffer reaches 500 entries, via one UPDATE ... FROM (VALUES ...).
// - Assumes a single Node process (Next.js standalone / systemd unit).
//   In multi-worker setups each worker has its own buffer; the totals merge correctly.
// - globalThis guard prevents duplicate intervals during dev HMR.

type Buffer = Map<number, number>;

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_MAX_ENTRIES = 500;

type Store = { buffer: Buffer; timer: NodeJS.Timeout | null; flushing: boolean };

const G = globalThis as typeof globalThis & { __viewsStore?: Store };

function getStore(): Store {
  if (!G.__viewsStore) {
    G.__viewsStore = { buffer: new Map(), timer: null, flushing: false };
  }
  return G.__viewsStore;
}

async function flush(): Promise<void> {
  const store = getStore();
  if (store.flushing || store.buffer.size === 0) return;
  store.flushing = true;
  const snapshot = Array.from(store.buffer.entries());
  store.buffer.clear();
  try {
    const ids = snapshot.map(([id]) => id);
    const deltas = snapshot.map(([, d]) => d);
    // Parallel arrays via unnest → a single UPDATE.
    await sql`
      UPDATE "Contents" c
      SET "ViewCount" = COALESCE(c."ViewCount", 0) + v.delta
      FROM unnest(${ids}::bigint[], ${deltas}::bigint[]) AS v(id, delta)
      WHERE c."ContentID" = v.id
    `;
  } catch (err) {
    // If the flush failed, put the entries back so they can retry instead of being lost.
    for (const [id, delta] of snapshot) {
      store.buffer.set(id, (store.buffer.get(id) ?? 0) + delta);
    }
    console.error("[views] flush error:", err);
  } finally {
    store.flushing = false;
  }
}

function ensureTimer(): void {
  const store = getStore();
  if (store.timer) return;
  store.timer = setInterval(() => {
    flush().catch(() => {});
  }, FLUSH_INTERVAL_MS);
  // No need to keep the Node process alive just for this.
  store.timer.unref?.();
}

export function queueView(contentId: number): void {
  if (!Number.isFinite(contentId) || contentId <= 0) return;
  const store = getStore();
  store.buffer.set(contentId, (store.buffer.get(contentId) ?? 0) + 1);
  ensureTimer();
  if (store.buffer.size >= FLUSH_MAX_ENTRIES) {
    flush().catch(() => {});
  }
}

// Manual flush for tests and admin tooling.
export async function flushViews(): Promise<void> {
  await flush();
}
