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

// Once per game: the same team can never appear on two of an entry's picks.
// Partial so legacy teamless wildcard rows (teamApiId: null) don't collide.
PickSchema.index(
  { entryId: 1, teamApiId: 1 },
  { unique: true, partialFilterExpression: { teamApiId: { $type: "number" } } }
);

// The resolve/summary hot path: all of a game week's picks in one query.
PickSchema.index({ gameId: 1, matchday: 1 });

export const Pick: Model<IPick> =
  (models.Pick as Model<IPick>) || model<IPick>("Pick", PickSchema);
