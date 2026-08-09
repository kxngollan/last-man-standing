import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * The string a player shares: lastmanstanding.app/r/<referralHandle>.
 *
 * One row per player, created on signup with their own id as the handle, so a
 * link works from day one. Changing the handle updates this row in place —
 * which is exactly why links already shared stop resolving at once.
 */
export interface IUserReferralHandle {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  referralHandle: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserReferralHandleSchema = new Schema<IUserReferralHandle>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    referralHandle: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

// One handle per player.
UserReferralHandleSchema.index({ userId: 1 }, { unique: true });

// Resolving a shared link is a lookup by handle, and the uniqueness here is
// what stops two players claiming the same string — it's the source of truth,
// not a pre-flight check.
UserReferralHandleSchema.index({ referralHandle: 1 }, { unique: true });

export const UserReferralHandle: Model<IUserReferralHandle> =
  (models.UserReferralHandle as Model<IUserReferralHandle>) ||
  model<IUserReferralHandle>("UserReferralHandle", UserReferralHandleSchema);
