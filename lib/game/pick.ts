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
  const prevTeam = existing?.teamApiId ?? null;

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
        // Changing team keeps an armed wildcard armed — it protects whatever
        // the week's pick ends up being.
        isWildcard: existing?.isWildcard ?? false,
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

/**
 * Play this game's single wildcard on the open game week's pick. The wildcard
 * protects the pick: a draw counts as going through, so only a loss knocks the
 * player out. It requires a team pick to attach to, and can be undone with
 * `undoWildcard` any time before the deadline.
 */
export async function useWildcard(userId: string): Promise<void> {
  await connectDB();
  const game = await getPlayableGame();
  const entry = await requireAliveEntry(game._id, userId);
  if (entry.wildcardUsed) throw new GameError("You’ve already used your wildcard this game.", 409);

  const window = await getPickWindow(game.season, game.currentMatchday);
  const md = window.matchday;
  if (window.locked) throw new GameError("There’s no open game week to pick right now.", 409);

  const existing = await Pick.findOne({ entryId: entry._id, matchday: md });
  if (!existing || existing.teamApiId == null) {
    throw new GameError("Pick a team first — the wildcard protects your pick.", 409);
  }

  existing.isWildcard = true;
  await existing.save();

  entry.wildcardUsed = true;
  await entry.save();
}

/** Take back a played wildcard, any time before the week locks. */
export async function undoWildcard(userId: string): Promise<void> {
  await connectDB();
  const game = await getPlayableGame();
  const entry = await requireAliveEntry(game._id, userId);

  const window = await getPickWindow(game.season, game.currentMatchday);
  const md = window.matchday;
  if (window.locked) throw new GameError("This week is locked — the wildcard is already in play.", 409);

  const existing = await Pick.findOne({ entryId: entry._id, matchday: md });
  if (!existing?.isWildcard) {
    throw new GameError("You haven’t played your wildcard this week.", 409);
  }

  if (existing.teamApiId == null) {
    // Legacy skip-the-week wildcard with no team attached — remove the row so
    // the player can pick fresh.
    await existing.deleteOne();
  } else {
    existing.isWildcard = false;
    await existing.save();
  }

  entry.wildcardUsed = false;
  await entry.save();
}
