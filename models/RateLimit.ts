import { Schema, model, models, type Model, type Types } from "mongoose";

/** One fixed-window rate-limit bucket — see lib/rateLimit.ts for the API. */
export interface IRateLimit {
  _id: Types.ObjectId;
  key: string;
  windowStart: Date;
  count: number;
  expireAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, default: 0 },
  expireAt: { type: Date, required: true },
});

// One bucket per key per window; the atomic upsert in rateLimit() relies on this.
RateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });

// Mongo reaps buckets shortly after their window closes.
RateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimit> =
  (models.RateLimit as Model<IRateLimit>) || model<IRateLimit>("RateLimit", RateLimitSchema);
