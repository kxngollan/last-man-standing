import { Schema, model, models, type Model, type Types } from "mongoose";

export type IssueCategory = "bug" | "scores" | "account" | "other";
export type IssueStatus = "open" | "resolved";

export interface IIssueReport {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  category: IssueCategory;
  message: string;
  /** Pathname the player was on when they reported — free debugging context. */
  page: string;
  status: IssueStatus;
  createdAt: Date;
  updatedAt: Date;
}

const IssueReportSchema = new Schema<IIssueReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["bug", "scores", "account", "other"],
      required: true,
    },
    message: { type: String, required: true, trim: true },
    page: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
  },
  { timestamps: true }
);

export const IssueReport: Model<IIssueReport> =
  (models.IssueReport as Model<IIssueReport>) ||
  model<IIssueReport>("IssueReport", IssueReportSchema);
