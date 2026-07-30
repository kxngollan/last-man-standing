import { connectDB } from "@/database/connect";
import { Pick } from "@/models/Pick";
import { Fixture } from "@/models/Fixture";
import { getActiveGame, requireAliveEntry } from "./queries";
import { getMatchdayDeadline, isLocked } from "./deadline";
import { GameError } from "./errors";

/** Make (or change) this week's team pick. */
export async function makePick(userId: string, teamApiId: number): Promise<void> {
  await connectDB();
  const game = await getActiveGame();
  const entry = await requireAliveEntry(game._id, userId);
  const md = game.currentMatchday;

  const deadline = await getMatchdayDeadline(game.season, md);
  if (isLocked(deadline)) throw new GameError("Picks are locked for this week.", 409);

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

/** Spend this game's single wildcard on the current week. */
export async function useWildcard(userId: string): Promise<void> {
  await connectDB();
  const game = await getActiveGame();
  const entry = await requireAliveEntry(game._id, userId);
  if (entry.wildcardUsed) throw new GameError("You’ve already used your wildcard this game.", 409);
  const md = game.currentMatchday;

  const deadline = await getMatchdayDeadline(game.season, md);
  if (isLocked(deadline)) throw new GameError("Picks are locked for this week.", 409);

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
