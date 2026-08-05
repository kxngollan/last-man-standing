import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IFeedback {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  rating: number; // 1–5
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export const Feedback: Model<IFeedback> =
  (models.Feedback as Model<IFeedback>) || model<IFeedback>("Feedback", FeedbackSchema);
