import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Who brought a player in. One row per referred player, written at signup.
 *
 * `referrerUserId` is an id, never a handle: handles can be changed and the
 * freed string claimed by someone else, so storing the string would hand the
 * credit to whoever took it next.
 *
 * `confirmed` flips when the new player verifies their email — signups that
 * never confirm an inbox don't count towards anybody's total.
 */
export interface IUserReferredBy {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  referrerUserId: Types.ObjectId;
  /** The string they arrived on, kept for the record only. */
  handleUsed: string;
  confirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserReferredBySchema = new Schema<IUserReferredBy>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    referrerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    handleUsed: { type: String, required: true, trim: true, lowercase: true },
    confirmed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A player is referred once, by one person, and it never changes after signup.
UserReferredBySchema.index({ userId: 1 }, { unique: true });

// "How many confirmed referrals does this player have?" — the count on their
// settings page and every row of the leaderboard.
UserReferredBySchema.index({ referrerUserId: 1, confirmed: 1 });

export const UserReferredBy: Model<IUserReferredBy> =
  (models.UserReferredBy as Model<IUserReferredBy>) ||
  model<IUserReferredBy>("UserReferredBy", UserReferredBySchema);
