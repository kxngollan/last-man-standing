import { Schema, model, models, type Model, type Types } from "mongoose";

export type OAuthProvider = "google" | "apple";

/**
 * A social sign-in linked to an account. `providerAccountId` is the provider's
 * subject id (`sub`) — the only stable handle on the identity. The email isn't:
 * people change it at Google, and Apple hands out relay addresses.
 */
export interface IOAuthAccount {
  provider: OAuthProvider;
  providerAccountId: string;
  /**
   * Apple only, and only so the account can be torn down properly: deleting an
   * account has to tell Apple to forget it too (App Review guideline
   * 5.1.1(v)), and Apple's revoke endpoint wants a token — see
   * lib/apple/revoke.ts.
   *
   * Absent on Google, which asks for nothing equivalent, and absent on Apple
   * accounts that signed in before this was recorded. Both are survivable: the
   * deletion goes ahead regardless.
   */
  refreshToken?: string;
  /**
   * Which Apple client that refresh token belongs to. Revocation has to present
   * the same one, and the web and the app don't share it — the site signs in
   * with the Services ID, the app with its bundle id. Getting it wrong fails
   * quietly, so it's recorded at sign-in rather than guessed at deletion.
   */
  clientId?: string;
}

export interface IUser {
  _id: Types.ObjectId;
  /** Full name ("First Last"). Kept in sync with firstName/lastName so the
   * auth session and legacy accounts (created before the split) keep working. */
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  /** Absent on accounts that have only ever signed in with Google or Apple.
   * They can give themselves one through the password-reset flow. */
  passwordHash?: string;
  /** Absent between an OAuth sign-up and /welcome — neither provider tells us a
   * date of birth, and the age gate needs one before they can play. */
  dob?: Date;
  /**
   * They declared a parent or guardian had given permission, which players
   * under PARENTAL_CONSENT_AGE must do before an account is created.
   *
   * A self-declaration, not verified consent — nobody contacts the guardian.
   * Kept because it is the record that the question was asked and answered,
   * which is what a store reviewer or a complaint would ask to see. False or
   * absent on anyone who was old enough not to be asked.
   */
  parentalConsent?: boolean;
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
  /** Linked social sign-ins. Left unset (rather than empty) on password-only
   * accounts so the sparse unique index below skips them. */
  oauthAccounts?: IOAuthAccount[];
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
    // Not `required`: an OAuth account starts life with neither. The sign-up
    // route still sets both on every account it creates.
    passwordHash: { type: String },
    dob: { type: Date },
    parentalConsent: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    banned: {type: Boolean, default: false},
    passwordChangedAt: { type: Date, default: null },
    hideFromReferralBoard: { type: Boolean, default: false },
    oauthAccounts: {
      type: [
        new Schema<IOAuthAccount>(
          {
            provider: { type: String, required: true, enum: ["google", "apple"] },
            providerAccountId: { type: String, required: true },
            refreshToken: { type: String },
            clientId: { type: String },
          },
          { _id: false }
        ),
      ],
      // Not `[]` — an empty array would still be indexed, and the unique index
      // below would then let only one password-only account exist.
      default: undefined,
    },
  },
  { timestamps: true }
);

// One Google/Apple identity belongs to one account. Without this, a race
// between two sign-ins could link the same provider account to two players.
UserSchema.index(
  { "oauthAccounts.provider": 1, "oauthAccounts.providerAccountId": 1 },
  { unique: true, sparse: true }
);

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
