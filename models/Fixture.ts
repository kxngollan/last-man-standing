import { Schema, model, models, type Model, type Types } from "mongoose";

export type FixtureStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED"
  | "AWARDED"; // decided off the pitch (forfeit etc.) — counts as a final result

export type FixtureWinner = "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;

export interface IFixture {
  _id: Types.ObjectId;
  apiId: number; // football-data.org match id
  season: number; // starting year, e.g. 2025 for 2025/26
  matchday: number; // Premier League game week
  homeTeamApiId: number;
  awayTeamApiId: number;
  utcKickoff: Date;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  winner: FixtureWinner;
  updatedAt: Date;
}

const FixtureSchema = new Schema<IFixture>(
  {
    apiId: { type: Number, required: true, unique: true },
    season: { type: Number, required: true },
    matchday: { type: Number, required: true },
    homeTeamApiId: { type: Number, required: true },
    awayTeamApiId: { type: Number, required: true },
    utcKickoff: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        "SCHEDULED",
        "TIMED",
        "IN_PLAY",
        "PAUSED",
        "FINISHED",
        "POSTPONED",
        "SUSPENDED",
        "CANCELLED",
        "AWARDED",
      ],
      required: true,
      default: "SCHEDULED",
    },
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    winner: { type: String, enum: ["HOME_TEAM", "AWAY_TEAM", "DRAW", null], default: null },
  },
  { timestamps: true }
);

FixtureSchema.index({ season: 1, matchday: 1 });

export const Fixture: Model<IFixture> =
  (models.Fixture as Model<IFixture>) || model<IFixture>("Fixture", FixtureSchema);
