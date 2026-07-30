import { Schema, model, models, type Model, type Types } from "mongoose";

export type EntryStatus = "alive" | "eliminated" | "winner";

export interface IEntry {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  userId: Types.ObjectId;
  status: EntryStatus;
  eliminatedAtMatchday: number | null;
  wildcardUsed: boolean;
  usedTeamApiIds: number[]; // teams already spent this game (enforces once-per-game)
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
    usedTeamApiIds: { type: [Number], default: [] },
  },
  { timestamps: true }
);

// One entry per user per game.
EntrySchema.index({ gameId: 1, userId: 1 }, { unique: true });

export const Entry: Model<IEntry> =
  (models.Entry as Model<IEntry>) || model<IEntry>("Entry", EntrySchema);
