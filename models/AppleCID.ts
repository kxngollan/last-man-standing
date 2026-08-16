import { Schema, model, models, type Model } from "mongoose";

export interface IAppleCID {
    secret: string;
  expiresAt: Date;
  createdAt: Date;
}

const AppleClientSecretSchema = new Schema<IAppleCID>({
    secret:{type:String, required:true},
  expiresAt: { type: Date, required: true, expires: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const AppleClientSecret: Model<IAppleCID> =
  (models.AppleClientSecret as Model<IAppleCID>) ||
  model<IAppleCID>("AppleClientSecret", AppleClientSecretSchema);
