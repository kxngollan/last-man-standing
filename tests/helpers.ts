import mongoose, { Types } from "mongoose";
import { connectDB } from "@/database/connect";
import { Game, type IGame } from "@/models/Game/Game";
import { Entry } from "@/models/Game/Entry";
import { Pick, type PickResult } from "@/models/Game/Pick";
import { Team } from "@/models/Teams/Team";
import { Fixture, type FixtureStatus, type FixtureWinner } from "@/models/Teams/Fixture";
import { User } from "@/models/User/User";
import { Lock } from "@/models/Lock";
import { RateLimit } from "@/models/RateLimit";
import { VerificationToken } from "@/models/User/VerificationToken";
import { PasswordResetToken } from "@/models/User/PasswordResetToken";

export const SEASON = 2025;

/** Connect and build every model's indexes (unique constraints matter here). */
export async function initDb(): Promise<void> {
  await connectDB();
  await Promise.all(
    [Game, Entry, Pick, Team, Fixture, User, Lock, RateLimit, VerificationToken, PasswordResetToken].map(
      (m) => m.init()
    )
  );
}

export async function clearDb(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function closeDb(): Promise<void> {
  await mongoose.disconnect();
}

export const HOUR = 60 * 60 * 1000;
export const past = (hours = 2) => new Date(Date.now() - hours * HOUR);
export const future = (hours = 2) => new Date(Date.now() + hours * HOUR);

/** Teams named alphabetically: apiId 1 → "Team A", 2 → "Team B", … */
export async function seedTeams(count: number): Promise<void> {
  await Team.insertMany(
    Array.from({ length: count }, (_, i) => ({
      apiId: i + 1,
      name: `Team ${String.fromCharCode(65 + i)}`,
      shortName: `T${String.fromCharCode(65 + i)}`,
      tla: `T${String.fromCharCode(65 + i)}A`,
      crest: null,
    }))
  );
}

export async function seedGame(
  overrides: Partial<IGame> = {}
): Promise<mongoose.HydratedDocument<IGame>> {
  return Game.create({
    status: "active",
    season: SEASON,
    startMatchday: 1,
    currentMatchday: 1,
    createdBy: new Types.ObjectId(),
    ...overrides,
  });
}

export interface FixtureSpec {
  home: number;
  away: number;
  kickoff?: Date;
  status?: FixtureStatus;
  winner?: FixtureWinner;
}

/** Fixtures for one matchday; apiId = matchday*100 + slot. */
export async function seedFixtures(matchday: number, specs: FixtureSpec[]): Promise<void> {
  await Fixture.insertMany(
    specs.map((s, i) => ({
      apiId: matchday * 100 + i,
      season: SEASON,
      matchday,
      homeTeamApiId: s.home,
      awayTeamApiId: s.away,
      utcKickoff: s.kickoff ?? past(),
      status: s.status ?? "FINISHED",
      homeScore: null,
      awayScore: null,
      winner: s.winner ?? null,
    }))
  );
}

export const fixtureApiId = (matchday: number, slot: number) => matchday * 100 + slot;

export async function seedUser(name: string): Promise<Types.ObjectId> {
  const user = await User.create({
    name,
    firstName: name,
    lastName: "Tester",
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    passwordHash: "x",
    dob: new Date("1990-01-01"),
    emailVerified: true,
  });
  return user._id;
}

export async function seedEntry(
  gameId: Types.ObjectId,
  name: string,
  opts: { status?: "alive" | "eliminated" | "winner"; wildcardUsed?: boolean } = {}
) {
  const userId = await seedUser(name);
  const entry = await Entry.create({
    gameId,
    userId,
    status: opts.status ?? "alive",
    wildcardUsed: opts.wildcardUsed ?? false,
  });
  return { entry, userId };
}

export async function seedPick(args: {
  gameId: Types.ObjectId;
  entryId: Types.ObjectId;
  userId: Types.ObjectId;
  matchday: number;
  teamApiId: number | null;
  fixtureApiId?: number | null;
  isWildcard?: boolean;
  result?: PickResult;
  autoPicked?: boolean;
}) {
  return Pick.create({
    gameId: args.gameId,
    entryId: args.entryId,
    userId: args.userId,
    matchday: args.matchday,
    teamApiId: args.teamApiId,
    fixtureApiId: args.fixtureApiId ?? null,
    result: args.result ?? "pending",
    isWildcard: args.isWildcard ?? false,
    autoPicked: args.autoPicked ?? false,
  });
}
