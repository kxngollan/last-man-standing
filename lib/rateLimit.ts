import { connectDB } from "@/database/connect";
import { RateLimit } from "@/models/RateLimit";

/**
 * Fixed-window rate limiter backed by MongoDB, so limits hold across
 * serverless instances and deploys. One atomic upsert per check.
 *
 * Returns true while the call is allowed, false once `limit` is exceeded
 * within the current window.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  await connectDB();
  const now = Date.now();
  const windowStart = new Date(now - (now % windowMs));

  const bump = () =>
    RateLimit.findOneAndUpdate(
      { key, windowStart },
      {
        $inc: { count: 1 },
        // Keep the bucket around for one extra window so a clock-skewed TTL
        // sweep can never resurrect capacity mid-window.
        $setOnInsert: { expireAt: new Date(windowStart.getTime() + windowMs * 2) },
      },
      { upsert: true, returnDocument: "after" }
    );

  let doc;
  try {
    doc = await bump();
  } catch (err) {
    // Two first-requests raced the upsert — the loser retries as a plain $inc.
    if ((err as { code?: number }).code !== 11000) throw err;
    doc = await bump();
  }
  return (doc?.count ?? 1) <= limit;
}

/**
 * The client IP to key rate limits on. Vercel's proxy sets x-real-ip from the
 * connection and it can't be spoofed by the caller; the first x-forwarded-for
 * entry IS caller-controlled, so it's only a local-dev fallback.
 */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}
