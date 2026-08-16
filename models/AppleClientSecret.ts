import { Schema, model, models, type Model } from "mongoose";

/**
 * The JWT Apple wants in place of a client secret, kept where every instance
 * can see it — see lib/apple/createClientSecret.ts for the mint/renew rules.
 *
 * One document per client ID (the Services ID for the web flow), so a second
 * Apple client can be added later without disturbing this one.
 */
export interface IAppleClientSecret {
  clientId: string;
  secret: string;
  /**
   * A hash of the team id, key id and private key this was signed with. Rotate
   * any of them and the stored secret is dead to Apple, however long it has
   * left to run — this is what lets that be noticed. Absent on rows written
   * before it was recorded, which are treated as stale.
   */
  fingerprint?: string;
  expiresAt: Date;
  createdAt: Date;
}

const AppleClientSecretSchema = new Schema<IAppleClientSecret>({
  clientId: { type: String, required: true, unique: true },
  secret: { type: String, required: true },
  fingerprint: { type: String },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Sweep a day after it expires. Not sooner: the renewal path replaces the
// document in place, and an expired row that is still readable is harmless —
// every reader filters on `expiresAt` anyway.
AppleClientSecretSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const AppleClientSecret: Model<IAppleClientSecret> =
  (models.AppleClientSecret as Model<IAppleClientSecret>) ||
  model<IAppleClientSecret>("AppleClientSecret", AppleClientSecretSchema);
