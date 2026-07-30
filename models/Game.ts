import { Schema, model, models, type Model, type Types } from "mongoose";

export type GameStatus = "registration" | "active" | "finished";

export interface IGame {
  _id: Types.ObjectId;
  status: GameStatus;
  season: number; // starting year, e.g. 2025
  startMatchday: number; // matchday game week 1 maps to
  currentMatchday: number; // matchday currently being played / awaited
  winnerUserId: Types.ObjectId | null;
  noWinner: boolean; // true when the game ended all-out (nobody left)
  createdBy: Types.ObjectId;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<IGame>(
  {
    status: {
      type: String,
      enum: ["registration", "active", "finished"],
      required: true,
      default: "registration",
    },
    season: { type: Number, required: true },
    startMatchday: { type: Number, required: true },
    currentMatchday: { type: Number, required: true },
    winnerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    noWinner: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Game: Model<IGame> =
  (models.Game as Model<IGame>) || model<IGame>("Game", GameSchema);
