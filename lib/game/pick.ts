import { connectDB } from "@/database/connect";
import { Pick } from "@/models/Pick";
import { Entry } from "@/models/Entry";
import { Fixture } from "@/models/Fixture";
import { getPlayableGame, requireAliveEntry } from "./queries";
import { getPickWindow } from "./pickWindow";
import { GameError } from "./errors";

/** True when `err` is a Mongo duplicate-key error on an index containing `field`. */
function isDupOn(err: unknown, field: string): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  return e?.code === 11000 && !!e.keyPattern && field in e.keyPattern;
}

/**
 * Make (or change) the pick for the open game week (this week, or the next once it locks).
 *
 * The once-per-game team rule is enforced by the partial unique index on
 * Pick (entryId, teamApiId) — concurrent double-picks surface as a clean 409
 * instead of drifting state. The pre-check below only exists for a friendly
 * error on the common path.
 */
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

  const alreadyUsed = await Pick.exists({
    entryId: entry._id,
    teamApiId,
    matchday: { $ne: md },
  });
  if (alreadyUsed) throw new GameError("You’ve already used that team this game.", 409);

  const upsert = () =>
    Pick.updateOne(
      { entryId: entry._id, matchday: md },
      {
        $set: {
          gameId: game._id,
          userId,
          teamApiId,
          fixtureApiId: fixture.apiId,
          result: "pending",
          autoPicked: false,
        },
        // Changing team keeps an armed wildcard armed — it protects whatever
        // the week's pick ends up being.
        $setOnInsert: { isWildcard: false },
      },
      { upsert: true }
    );

  try {
    await upsert();
  } catch (err) {
    if (isDupOn(err, "teamApiId")) {
      throw new GameError("You’ve already used that team this game.", 409);
    }
    if (isDupOn(err, "matchday")) {
      // Lost an upsert race for this week's row — it exists now, so retry
      // resolves to a plain update (which can still hit the team-reuse index).
      try {
        await upsert();
      } catch (err2) {
        if (isDupOn(err2, "teamApiId")) {
          throw new GameError("You’ve already used that team this game.", 409);
        }
        throw err2;
      }
      return;
    }
    throw err;
  }
}

/**
 * Play this game's single wildcard on the open game week's pick. The wildcard
 * protects the pick: a draw counts as going through, so only a loss knocks the
 * player out. It requires a team pick to attach to, and can be undone with
 * `undoWildcard` any time before the deadline.
 */
export async function playWildcard(userId: string): Promise<void> {
  await connectDB();
  const game = await getPlayableGame();
  const entry = await requireAliveEntry(game._id, userId);

  const window = await getPickWindow(game.season, game.currentMatchday);
  const md = window.matchday;
  if (window.locked) throw new GameError("There’s no open game week to pick right now.", 409);

  // Atomically claim the game's single wildcard…
  const claimed = await Entry.updateOne(
    { _id: entry._id, wildcardUsed: false },
    { $set: { wildcardUsed: true } }
  );
  if (claimed.modifiedCount === 0) {
    throw new GameError("You’ve already used your wildcard this game.", 409);
  }

  // …then arm it on this week's pick, releasing the claim if there's none.
  const armed = await Pick.findOneAndUpdate(
    { entryId: entry._id, matchday: md, teamApiId: { $ne: null } },
    { $set: { isWildcard: true } }
  );
  if (!armed) {
    await Entry.updateOne({ _id: entry._id }, { $set: { wildcardUsed: false } });
    throw new GameError("Pick a team first — the wildcard protects your pick.", 409);
  }
}

/** Take back a played wildcard, any time before the week locks. */
export async function undoWildcard(userId: string): Promise<void> {
  await connectDB();
  const game = await getPlayableGame();
  const entry = await requireAliveEntry(game._id, userId);

  const window = await getPickWindow(game.season, game.currentMatchday);
  const md = window.matchday;
  if (window.locked) throw new GameError("This week is locked — the wildcard is already in play.", 409);

  const disarmed = await Pick.findOneAndUpdate(
    { entryId: entry._id, matchday: md, isWildcard: true, teamApiId: { $ne: null } },
    { $set: { isWildcard: false } }
  );
  if (!disarmed) {
    // Legacy skip-the-week wildcard with no team attached — remove the row so
    // the player can pick fresh.
    const legacy = await Pick.findOneAndDelete({
      entryId: entry._id,
      matchday: md,
      isWildcard: true,
      teamApiId: null,
    });
    if (!legacy) throw new GameError("You haven’t played your wildcard this week.", 409);
  }

  await Entry.updateOne({ _id: entry._id }, { $set: { wildcardUsed: false } });
}
