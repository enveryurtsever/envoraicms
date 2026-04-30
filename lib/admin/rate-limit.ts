import "server-only";

type Bucket = { tokens: number; resetAt: number };

const G = globalThis as typeof globalThis & {
  __adminRateLimits?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  if (!G.__adminRateLimits) G.__adminRateLimits = new Map();
  return G.__adminRateLimits;
}

export function checkRateLimit(
  key: string,
  max = 30,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const m = store();
  const now = Date.now();
  let bucket = m.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { tokens: max, resetAt: now + windowMs };
    m.set(key, bucket);
  }
  if (bucket.tokens <= 0) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.tokens -= 1;
  return { ok: true };
}
