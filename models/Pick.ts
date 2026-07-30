import { Schema, model, models, type Model, type Types } from "mongoose";

export type PickResult = "pending" | "win" | "draw" | "loss" | "postponed" | "safe";

export interface IPick {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  entryId: Types.ObjectId;
  userId: Types.ObjectId;
  matchday: number;
  teamApiId: number | null; // null for a wildcard week
  fixtureApiId: number | null;
  result: PickResult;
  isWildcard: boolean;
  autoPicked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PickSchema = new Schema<IPick>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true },
    entryId: { type: Schema.Types.ObjectId, ref: "Entry", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    matchday: { type: Number, required: true },
    teamApiId: { type: Number, default: null },
    fixtureApiId: { type: Number, default: null },
    result: {
      type: String,
      enum: ["pending", "win", "draw", "loss", "postponed", "safe"],
      default: "pending",
    },
    isWildcard: { type: Boolean, default: false },
    autoPicked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One pick per entry per matchday.
PickSchema.index({ entryId: 1, matchday: 1 }, { unique: true });

export const Pick: Model<IPick> =
  (models.Pick as Model<IPick>) || model<IPick>("Pick", PickSchema);
