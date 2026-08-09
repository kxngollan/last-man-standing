import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IPasswordResetToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string; // sha256 of the raw token we email
  expiresAt: Date;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL — auto-removed when expired
  createdAt: { type: Date, default: Date.now },
});

export const PasswordResetToken: Model<IPasswordResetToken> =
  (models.PasswordResetToken as Model<IPasswordResetToken>) ||
  model<IPasswordResetToken>("PasswordResetToken", PasswordResetTokenSchema);
