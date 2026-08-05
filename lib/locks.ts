import { connectDB } from "@/database/connect";
import { Lock } from "@/models/Lock";

/**
 * Mongo-backed leases, safe across serverless instances. A lease expires on
 * its own after `ttlMs`, so a crashed holder can never wedge the system —
 * callers should still release in a `finally` to hand it back promptly.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  await connectDB();
  const now = new Date();
  try {
    // Atomic: refresh an expired lease, or insert a fresh one. If the lease
    // is live the filter matches nothing and the insert hits the unique key.
    await Lock.findOneAndUpdate(
      { key, until: { $lt: now } },
      { $set: { until: new Date(now.getTime() + ttlMs) } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false; // someone holds it
    throw err;
  }
}

export async function releaseLock(key: string): Promise<void> {
  await Lock.updateOne({ key }, { $set: { until: new Date(0) } });
}
