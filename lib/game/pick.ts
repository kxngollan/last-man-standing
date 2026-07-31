import { connectDB } from "@/database/connect";
import { Pick } from "@/models/Pick";
import { Fixture } from "@/models/Fixture";
import { getPlayableGame, requireAliveEntry } from "./queries";
import { getPickWindow } from "./pickWindow";
import { GameError } from "./errors";

/** Make (or change) the pick for the open game week (this week, or the next once it locks). */
export async function makePick(userId: string, teamApiId: number): Promise<void> {
  await connectDB();
  const game = await getPlayableGame();
  const entry = await requireAliveEntry(game._id, userId);

  const window = await getPickWindow(game.season, game.currentMatchday);
  const md = window.matchday;
  if (window.locked) throw new GameError("There’s no open game week to pick right now.", 409);

  const fixture = await Fixture.findOne({
    season: game.season,
    matchday: md,
    $or: [{ homeTeamApiId: teamApiId }, { awayTeamApiId: teamApiId }],
  }).lean();
  if (!fixture) throw new GameError("That team doesn’t play this game week.", 400);

  const existing = await Pick.findOne({ entryId: entry._id, matchday: md });
  const prevTeam = existing && !existing.isWildcard ? existing.teamApiId : null;

  if (entry.usedTeamApiIds.includes(teamApiId) && prevTeam !== teamApiId) {
    throw new GameError("You’ve already used that team this game.", 409);
  }

  await Pick.updateOne(
    { entryId: entry._id, matchday: md },
    {
      $set: {
        gameId: game._id,
        userId,
        matchday: md,
        teamApiId,
        fixtureApiId: fixture.apiId,
        result: "pending",
        isWildcard: false,
        autoPicked: false,
      },
    },
    { upsert: true }
  );

  const used = new Set(entry.usedTeamApiIds);
  if (prevTeam) used.delete(prevTeam);
  used.add(teamApiId);
  entry.usedTeamApiIds = [...used];
  await entry.save();
}

/** Spend this game's single wildcard on the open game week. */
export async function useWildcard(userId: string): Promise<void> {
  await connectDB();
  const game = await getPlayableGame();
  const entry = await requireAliveEntry(game._id, userId);
  if (entry.wildcardUsed) throw new GameError("You’ve already used your wildcard this game.", 409);

  const window = await getPickWindow(game.season, game.currentMatchday);
  const md = window.matchday;
  if (window.locked) throw new GameError("There’s no open game week to pick right now.", 409);

  const existing = await Pick.findOne({ entryId: entry._id, matchday: md });
  const prevTeam = existing && !existing.isWildcard ? existing.teamApiId : null;

  await Pick.updateOne(
    { entryId: entry._id, matchday: md },
    {
      $set: {
        gameId: game._id,
        userId,
        matchday: md,
        teamApiId: null,
        fixtureApiId: null,
        result: "safe",
        isWildcard: true,
        autoPicked: false,
      },
    },
    { upsert: true }
  );

  if (prevTeam) {
    const used = new Set(entry.usedTeamApiIds);
    used.delete(prevTeam);
    entry.usedTeamApiIds = [...used];
  }
  entry.wildcardUsed = true;
  await entry.save();
}
