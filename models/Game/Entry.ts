import { Schema, model, models, type Model, type Types } from "mongoose";

export type EntryStatus = "alive" | "eliminated" | "winner";

export interface IEntry {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  userId: Types.ObjectId;
  status: EntryStatus;
  eliminatedAtMatchday: number | null;
  wildcardUsed: boolean;
  /**
   * The last game week whose result email this player has been sent. Stops a
   * repeated (or resumed) notify run emailing the same verdict twice; cleared
   * by an undo, so a corrected resolution notifies again.
   */
  resultEmailedMatchday: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const EntrySchema = new Schema<IEntry>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["alive", "eliminated", "winner"],
      required: true,
      default: "alive",
    },
    eliminatedAtMatchday: { type: Number, default: null },
    wildcardUsed: { type: Boolean, default: false },
    resultEmailedMatchday: { type: Number, default: null },
  },
  { timestamps: true }
);

// One entry per user per game.
EntrySchema.index({ gameId: 1, userId: 1 }, { unique: true });

// Alive-count and standings queries run on every portal request.
EntrySchema.index({ gameId: 1, status: 1 });

// A player's career across games — the profile page's first query. The
// {gameId, userId} index can't serve this one: gameId is its prefix.
EntrySchema.index({ userId: 1 });

export const Entry: Model<IEntry> =
  (models.Entry as Model<IEntry>) || model<IEntry>("Entry", EntrySchema);
