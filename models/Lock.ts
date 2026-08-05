import { Schema, model, models, type Model, type Types } from "mongoose";

/** A short-lived distributed lease — see lib/locks.ts for the acquire/release API. */
export interface ILock {
  _id: Types.ObjectId;
  key: string;
  until: Date;
}

const LockSchema = new Schema<ILock>({
  key: { type: String, required: true, unique: true },
  until: { type: Date, required: true },
});

// Sweep stale lock documents an hour after they expire.
LockSchema.index({ until: 1 }, { expireAfterSeconds: 3600 });

export const Lock: Model<ILock> =
  (models.Lock as Model<ILock>) || model<ILock>("Lock", LockSchema);
