import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IVerificationToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string; // sha256 of the raw token we email
  expiresAt: Date;
  createdAt: Date;
}

const VerificationTokenSchema = new Schema<IVerificationToken>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  // TTL index — MongoDB removes the document once expiresAt passes.
  expiresAt: { type: Date, required: true, expires: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const VerificationToken: Model<IVerificationToken> =
  (models.VerificationToken as Model<IVerificationToken>) ||
  model<IVerificationToken>("VerificationToken", VerificationTokenSchema);
