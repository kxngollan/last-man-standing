import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IUser {
  _id: Types.ObjectId;
  /** Full name ("First Last"). Kept in sync with firstName/lastName so the
   * auth session and legacy accounts (created before the split) keep working. */
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  passwordHash: string;
  dob: Date;
  emailVerified: boolean;
  isAdmin: boolean;
  banned: boolean;
  /**
   * When the password last changed. Sessions issued before this are refused at
   * the next claims refresh, so changing a password drops every other device.
   * Null for accounts that have never changed it.
   */
  passwordChangedAt: Date | null;
  /** Opted out of the public referral leaderboard. Their own count still shows. */
  hideFromReferralBoard: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    dob: { type: Date, required: true },
    emailVerified: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    banned: {type: Boolean, default: false},
    passwordChangedAt: { type: Date, default: null },
    hideFromReferralBoard: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
