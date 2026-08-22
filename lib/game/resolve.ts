import mongoose, { type HydratedDocument, type Types } from "mongoose";
import { connectDB } from "@/database/connect";
import { Game, type IGame } from "@/models/Game/Game";
import { Entry } from "@/models/Game/Entry";
import { Pick, type PickResult } from "@/models/Game/Pick";
import { Team } from "@/models/Teams/Team";
import { Fixture } from "@/models/Teams/Fixture";
import { syncFixtures } from "@/lib/football-api/sync";
import { acquireLock, releaseLock } from "@/lib/locks";
import { INCOMPLETE_STATUSES, UNPLAYABLE_STATUSES, DECIDED_STATUSES } from "./constants";
import { getMatchdayDeadline, isLocked } from "./deadline";
import { GameError } from "./errors";

/**
 * Assign the alphabetically-first still-available team to every alive entry
 * with no pick for `md`. Runs from the cron as soon as the week locks — before
 * any results exist, so the assignment is hindsight-free and visible to the
 * player for the rest of the week. Teams whose fixture can't produce a result
 * (postponed/cancelled/suspended) are never assigned.
 *
 * Idempotent: the unique (entryId, matchday) index turns re-runs and
 * concurrent runs into no-ops.
 */
export async function autoPickForMatchday(
  game: HydratedDocument<IGame>,
  md: number
): Promise<number> {
  await connectDB();
  const deadline = await getMatchdayDeadline(game.season, md);
  if (!isLocked(deadline)) return 0; // never assign before the week locks

  const [aliveEntries, fixtures, teams, picks] = await Promise.all([
    Entry.find({ gameId: game._id, status: "alive" }).lean(),
    Fixture.find({ season: game.season, matchday: md }).lean(),
    Team.find({}).lean(),
    Pick.find({ gameId: game._id }).select("entryId matchday teamApiId").lean(),
  ]);

  const teamName = new Map(teams.map((t) => [t.apiId, t.name]));
  const fixtureForTeam = new Map<number, number>();
  for (const f of fixtures) {
    if (UNPLAYABLE_STATUSES.includes(f.status)) continue;
    fixtureForTeam.set(f.homeTeamApiId, f.apiId);
    fixtureForTeam.set(f.awayTeamApiId, f.apiId);
  }
  const playable = [...fixtureForTeam.keys()].sort((a, b) =>
    (teamName.get(a) ?? "").localeCompare(teamName.get(b) ?? "")
  );

  const usedByEntry = new Map<string, Set<number>>();
  const hasPickForMd = new Set<string>();
  for (const p of picks) {
    const key = String(p.entryId);
    if (p.matchday === md) hasPickForMd.add(key);
    if (p.teamApiId != null) {
      let used = usedByEntry.get(key);
      if (!used) usedByEntry.set(key, (used = new Set()));
      used.add(p.teamApiId);
    }
  }

  const docs = [];
  for (const entry of aliveEntries) {
    const key = String(entry._id);
    if (hasPickForMd.has(key)) continue;
    const used = usedByEntry.get(key);
    const chosen = playable.find((id) => !used?.has(id));
    if (chosen == null) continue; // no team left — resolved as eliminated later

    docs.push({
      gameId: game._id,
      entryId: entry._id,
      userId: entry.userId,
      matchday: md,
      teamApiId: chosen,
      fixtureApiId: fixtureForTeam.get(chosen) ?? null,
      result: "pending" as const,
      isWildcard: false,
      autoPicked: true,
    });
  }
  if (docs.length === 0) return 0;

  try {
    await Pick.insertMany(docs, { ordered: false });
  } catch (err) {
    // A concurrent run inserted some of the same picks — the unique indexes
    // make that harmless. Anything else should surface.
    const bulk = err as { code?: number; writeErrors?: Array<{ code?: number }> };
    const writeErrors = bulk.writeErrors ?? [];
    const onlyDups =
      bulk.code === 11000 ||
      (writeErrors.length > 0 && writeErrors.every((w) => w.code === 11000));
    if (!onlyDups) throw err;
  }
  return docs.length;
}

export interface ResolveResult {
  complete: boolean;
  matchday: number;
  outcome?: "advanced" | "winner" | "all-out";
  eliminated?: number;
  aliveNow?: number;
  message?: string;
}

export interface ResolveOptions {
  /** Admin override: resolve despite unfinished fixtures — their picks score "safe". */
  force?: boolean;
  /** Skip the pre-resolve fixture sync (used by the cron, which just synced). */
  skipSync?: boolean;
}

/**
 * Resolve the active game's current matchday once its fixtures are complete.
 * Idempotent, lease-guarded (cron and admin can overlap safely), and all
 * writes happen in one transaction so a crash can never leave a half-resolved
 * week behind.
 */
export async function resolveMatchday(
  gameId: string,
  opts: ResolveOptions = {}
): Promise<ResolveResult> {
  await connectDB();
  const game = await Game.findById(gameId);
  if (!game) throw new GameError("Game not found.", 404);
  if (game.status !== "active") {
    return { complete: false, matchday: game.currentMatchday, message: "Game is not active." };
  }

  const md = game.currentMatchday;
  const lock = `resolve:${gameId}`;
  if (!(await acquireLock(lock, 2 * 60_000))) {
    return { complete: false, matchday: md, message: "Another resolution is already running." };
  }
  try {
    return await doResolve(game, md, opts);
  } finally {
    await releaseLock(lock);
  }
}

const setResult = (id: Types.ObjectId, result: PickResult) => ({
  updateOne: { filter: { _id: id }, update: { $set: { result } } },
});

async function doResolve(
  game: HydratedDocument<IGame>,
  md: number,
  opts: ResolveOptions
): Promise<ResolveResult> {
  if (!opts.skipSync) {
    try {
      await syncFixtures(game.season, md); // pull latest results
    } catch (err) {
      // API hiccup — resolve from the last-synced fixtures. The stillPlaying
      // guard below still blocks resolution until every fixture is final.
      console.warn("[resolve] fixture sync failed, using stored results:", (err as Error).message);
    }
  }

  const fixtures = await Fixture.find({ season: game.season, matchday: md }).lean();
  if (fixtures.length === 0) {
    return { complete: false, matchday: md, message: "No fixtures loaded for this matchday." };
  }
  const stillPlaying = fixtures.some((f) => INCOMPLETE_STATUSES.includes(f.status));
  if (stillPlaying && !opts.force) {
    return { complete: false, matchday: md, message: "Matchday not finished yet." };
  }

  // Safety net for a cron that was down at the deadline — normally auto-picks
  // were already assigned at lock time, and this is a no-op.
  await autoPickForMatchday(game, md);

  const fixtureById = new Map(fixtures.map((f) => [f.apiId, f]));
  let eliminated = 0;
  let aliveNow = 0;
  let outcome: ResolveResult["outcome"];

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      eliminated = 0; // withTransaction may retry — recompute from scratch

      // Sequential on purpose: a Mongo session can't run concurrent operations.
      const aliveEntries = await Entry.find({ gameId: game._id, status: "alive" }).session(
        session
      );
      const picks = await Pick.find({ gameId: game._id, matchday: md }).session(session);
      const pickByEntry = new Map(picks.map((p) => [String(p.entryId), p]));

      const pickOps: ReturnType<typeof setResult>[] = [];
      const eliminatedIds: Types.ObjectId[] = [];

      for (const entry of aliveEntries) {
        const pick = pickByEntry.get(String(entry._id));

        if (!pick) {
          // No team could be assigned (all teams used) — out.
          eliminatedIds.push(entry._id);
          continue;
        }

        if (pick.isWildcard && pick.teamApiId == null) {
          // Legacy skip-the-week wildcard (no team attached) — unconditionally safe.
          pickOps.push(setResult(pick._id, "safe"));
          continue;
        }

        const f = pick.fixtureApiId ? fixtureById.get(pick.fixtureApiId) : undefined;
        if (!f || !DECIDED_STATUSES.includes(f.status) || !f.winner) {
          // Postponed / cancelled / force-resolved before finishing → safe.
          pickOps.push(setResult(pick._id, "postponed"));
          continue;
        }

        const isHome = f.homeTeamApiId === pick.teamApiId;
        const won =
          (f.winner === "HOME_TEAM" && isHome) || (f.winner === "AWAY_TEAM" && !isHome);
        const drew = f.winner === "DRAW";

        // The wildcard protects the pick: a draw is enough to go through, so
        // only a loss knocks a wildcard player out.
        if (won || (drew && pick.isWildcard)) {
          pickOps.push(setResult(pick._id, won ? "win" : "draw"));
        } else {
          pickOps.push(setResult(pick._id, drew ? "draw" : "loss"));
          eliminatedIds.push(entry._id);
        }
      }

      if (pickOps.length) await Pick.bulkWrite(pickOps, { session });

      if (eliminatedIds.length) {
        await Entry.updateMany(
          { _id: { $in: eliminatedIds } },
          { $set: { status: "eliminated", eliminatedAtMatchday: md } },
          { session }
        );
        // An eliminated player's pick-ahead rows are void: refund a wildcard
        // armed on one of them, then delete them.
        const futurePicks = await Pick.find({
          entryId: { $in: eliminatedIds },
          matchday: { $gt: md },
        }).session(session);
        if (futurePicks.length) {
          const refundIds = futurePicks.filter((p) => p.isWildcard).map((p) => p.entryId);
          await Pick.deleteMany({ _id: { $in: futurePicks.map((p) => p._id) } }, { session });
          if (refundIds.length) {
            await Entry.updateMany(
              { _id: { $in: refundIds } },
              { $set: { wildcardUsed: false } },
              { session }
            );
          }
        }
      }
      eliminated = eliminatedIds.length;

      // Decide the game's fate.
      aliveNow = await Entry.countDocuments({ gameId: game._id, status: "alive" }).session(
        session
      );
      // A previously interrupted run may have crowned the winner already —
      // never let a re-run turn a won game into "no winner".
      const priorWinner = await Entry.findOne({ gameId: game._id, status: "winner" }).session(
        session
      );

      if (aliveNow === 1) {
        const winner = await Entry.findOneAndUpdate(
          { gameId: game._id, status: "alive" },
          { $set: { status: "winner" } },
          { session, returnDocument: "after" }
        );
        game.winnerUserId = winner?.userId ?? null;
        game.status = "finished";
        game.finishedAt = new Date();
        outcome = "winner";
      } else if (aliveNow === 0 && priorWinner) {
        game.winnerUserId = priorWinner.userId;
        game.status = "finished";
        game.finishedAt = game.finishedAt ?? new Date();
        outcome = "winner";
      } else if (aliveNow === 0) {
        // All-out: nobody wins, admin starts a fresh game.
        game.status = "finished";
        game.noWinner = true;
        game.finishedAt = new Date();
        outcome = "all-out";
      } else {
        game.currentMatchday = md + 1;
        outcome = "advanced";
      }
      await game.save({ session });
    });
  } finally {
    await session.endSession();
  }

  if (outcome === "advanced") {
    // Pre-load next matchday fixtures so the new deadline is known.
    try {
      await syncFixtures(game.season, md + 1);
    } catch {
      /* non-fatal — the cron retries on its next tick */
    }
  }

  return { complete: true, matchday: md, outcome, eliminated, aliveNow };
}

/* ---- Undo (admin escape hatch) ------------------------------------------ */

export interface UndoableResolution {
  game: HydratedDocument<IGame>;
  /** The matchday that would be put back into play. */
  matchday: number;
}

/**
 * The most recent resolution an admin could undo, if there is one: the newest
 * game that has resolved at least one week. A finished game still counts —
 * that's the accident worth undoing most (a force-resolve that crowned a
 * winner), and `currentMatchday` was never advanced when the game ended, so it
 * *is* the resolved week.
 */
export async function getUndoableResolution(): Promise<UndoableResolution | null> {
  await connectDB();
  const game = await Game.findOne({ status: { $in: ["active", "finished"] } }).sort({
    createdAt: -1,
  });
  if (!game) return null;
  const md = game.status === "finished" ? game.currentMatchday : game.currentMatchday - 1;
  if (md < game.startMatchday) return null; // nothing resolved yet
  return { game, matchday: md };
}

export interface UnresolveResult {
  matchday: number;
  gameWeek: number;
  /** Entries put back to "alive" — eliminations, plus a crowned winner. */
  restored: number;
  /** True when the undo also reopened a game that the resolution had ended. */
  reopened: boolean;
}

/**
 * Undo the last resolution: put the week back into play, revive everyone it
 * knocked out, and reset that week's picks to "pending". Reverses everything
 * `doResolve` writes, with one exception it cannot recover — the pick-ahead
 * rows (matchday > md) that were deleted from the entries it eliminated.
 * Those players are alive again and free to re-enter them; the wildcard
 * refunded off such a row stays refunded, which matches the deleted pick.
 *
 * Shares the resolve lease, so an undo can never race a resolution.
 */
export async function unresolveMatchday(gameId: string): Promise<UnresolveResult> {
  await connectDB();
  const game = await Game.findById(gameId);
  if (!game) throw new GameError("Game not found.", 404);
  if (game.status === "registration") {
    throw new GameError("This game hasn’t started yet — there’s nothing to undo.", 409);
  }

  const md = game.status === "finished" ? game.currentMatchday : game.currentMatchday - 1;
  if (md < game.startMatchday) {
    throw new GameError("No game week has been resolved yet.", 409);
  }
  const reopened = game.status === "finished";
  if (reopened) {
    // Reopening this one while another game is open would leave two live at
    // once — the portal assumes a single global game.
    const other = await Game.findOne({
      _id: { $ne: game._id },
      status: { $in: ["registration", "active"] },
    });
    if (other) {
      throw new GameError(
        "Another game is already open. Remove that one before reopening this game.",
        409
      );
    }
  }

  const lock = `resolve:${gameId}`;
  if (!(await acquireLock(lock, 2 * 60_000))) {
    throw new GameError("A resolution is running right now. Try again in a moment.", 409);
  }
  try {
    let restored = 0;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        restored = 0; // withTransaction may retry — recompute from scratch

        await Pick.updateMany(
          { gameId: game._id, matchday: md },
          { $set: { result: "pending" } },
          { session }
        );

        const revived = await Entry.updateMany(
          { gameId: game._id, status: "eliminated", eliminatedAtMatchday: md },
          { $set: { status: "alive", eliminatedAtMatchday: null } },
          { session }
        );
        restored = revived.modifiedCount;

        if (reopened) {
          // The winner was crowned by this resolution — uncrown them.
          const uncrowned = await Entry.updateMany(
            { gameId: game._id, status: "winner" },
            { $set: { status: "alive", eliminatedAtMatchday: null } },
            { session }
          );
          restored += uncrowned.modifiedCount;
        }

        game.status = "active";
        game.currentMatchday = md;
        game.winnerUserId = null;
        game.noWinner = false;
        game.finishedAt = null;
        await game.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return { matchday: md, gameWeek: md - game.startMatchday + 1, restored, reopened };
  } finally {
    await releaseLock(lock);
  }
}
