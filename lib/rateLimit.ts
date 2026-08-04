// Minimal in-memory fixed-window rate limiter. Per-instance only (resets on
// deploy/restart and isn't shared across serverless instances) — fine as a
// first line of defence for low-traffic auth endpoints.
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the call is allowed, false once `limit` is exceeded within the window. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Opportunistic sweep so abandoned keys don't accumulate forever.
  if (buckets.size > 1000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
