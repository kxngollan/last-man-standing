import type { HydratedDocument } from "mongoose";
import { connectDB } from "@/database/connect";
import { Game, type IGame } from "@/models/Game";
import { Entry } from "@/models/Entry";
import { Pick } from "@/models/Pick";
import { Team } from "@/models/Team";
import { Fixture } from "@/models/Fixture";
import { syncFixtures } from "@/lib/football-api/sync";
import { INCOMPLETE_STATUSES } from "./constants";
import { GameError } from "./errors";

/**
 * Assign the alphabetically-first still-available team to every alive entry
 * that has no pick for the current matchday.
 */
export async function autoPickForMissed(game: HydratedDocument<IGame>): Promise<number> {
  const md = game.currentMatchday;
  const [aliveEntries, fixtures, teams] = await Promise.all([
    Entry.find({ gameId: game._id, status: "alive" }),
    Fixture.find({ season: game.season, matchday: md }).lean(),
    Team.find({}).lean(),
  ]);

  const teamName = new Map(teams.map((t) => [t.apiId, t.name]));
  const fixtureForTeam = new Map<number, number>();
  for (const f of fixtures) {
    fixtureForTeam.set(f.homeTeamApiId, f.apiId);
    fixtureForTeam.set(f.awayTeamApiId, f.apiId);
  }
  const playingTeamIds = [...fixtureForTeam.keys()];

  let assigned = 0;
  for (const entry of aliveEntries) {
    const existing = await Pick.findOne({ entryId: entry._id, matchday: md });
    if (existing) continue;

    const chosen = playingTeamIds
      .filter((id) => !entry.usedTeamApiIds.includes(id))
      .sort((a, b) => (teamName.get(a) ?? "").localeCompare(teamName.get(b) ?? ""))[0];

    if (chosen == null) continue; // no team left — resolved as eliminated below

    await Pick.create({
      gameId: game._id,
      entryId: entry._id,
      userId: entry.userId,
      matchday: md,
      teamApiId: chosen,
      fixtureApiId: fixtureForTeam.get(chosen) ?? null,
      result: "pending",
      isWildcard: false,
      autoPicked: true,
    });
    entry.usedTeamApiIds = [...new Set([...entry.usedTeamApiIds, chosen])];
    await entry.save();
    assigned++;
  }
  return assigned;
}

export interface ResolveResult {
  complete: boolean;
  matchday: number;
  outcome?: "advanced" | "winner" | "all-out";
  eliminated?: number;
  aliveNow?: number;
  message?: string;
}

/**
 * Resolve the active game's current matchday once its fixtures are complete.
 * Idempotent: does nothing until the matchday is complete, and advances the
 * game exactly once per matchday.
 */
export async function resolveMatchday(gameId: string): Promise<ResolveResult> {
  await connectDB();
  const game = await Game.findById(gameId);
  if (!game) throw new GameError("Game not found.", 404);
  if (game.status !== "active") {
    return { complete: false, matchday: game.currentMatchday, message: "Game is not active." };
  }

  const md = game.currentMatchday;
  try {
    await syncFixtures(game.season, md); // pull latest results
  } catch (err) {
    // API hiccup — resolve from the last-synced fixtures. The stillPlaying
    // guard below still blocks resolution until every fixture is final.
    console.warn("[resolve] fixture sync failed, using stored results:", (err as Error).message);
  }
  const fixtures = await Fixture.find({ season: game.season, matchday: md }).lean();
  if (fixtures.length === 0) {
    return { complete: false, matchday: md, message: "No fixtures loaded for this matchday." };
  }
  const stillPlaying = fixtures.some((f) => INCOMPLETE_STATUSES.includes(f.status));
  if (stillPlaying) {
    return { complete: false, matchday: md, message: "Matchday not finished yet." };
  }

  // Everyone who forgot to pick gets an auto-pick, then we resolve.
  await autoPickForMissed(game);

  const fixtureById = new Map(fixtures.map((f) => [f.apiId, f]));
  const aliveEntries = await Entry.find({ gameId: game._id, status: "alive" });
  let eliminated = 0;

  for (const entry of aliveEntries) {
    const pick = await Pick.findOne({ entryId: entry._id, matchday: md });

    if (!pick) {
      // No team could be assigned (all teams used) — out.
      entry.status = "eliminated";
      entry.eliminatedAtMatchday = md;
      await entry.save();
      eliminated++;
      continue;
    }

    if (pick.isWildcard && pick.teamApiId == null) {
      // Legacy skip-the-week wildcard (no team attached) — unconditionally safe.
      pick.result = "safe";
      await pick.save();
      continue;
    }

    const f = pick.fixtureApiId ? fixtureById.get(pick.fixtureApiId) : undefined;
    if (!f || f.status !== "FINISHED") {
      // Postponed / cancelled / no result → safe (as if they'd won).
      pick.result = "postponed";
      await pick.save();
      continue;
    }

    const isHome = f.homeTeamApiId === pick.teamApiId;
    const won =
      (f.winner === "HOME_TEAM" && isHome) || (f.winner === "AWAY_TEAM" && !isHome);
    const drew = f.winner === "DRAW";

    // The wildcard protects the pick: a draw is enough to go through, so only
    // a loss knocks a wildcard player out.
    if (won || (drew && pick.isWildcard)) {
      pick.result = won ? "win" : "draw";
      await pick.save();
    } else {
      pick.result = drew ? "draw" : "loss";
      await pick.save();
      entry.status = "eliminated";
      entry.eliminatedAtMatchday = md;
      await entry.save();
      eliminated++;
    }
  }

  // Decide the game's fate.
  const aliveNow = await Entry.countDocuments({ gameId: game._id, status: "alive" });
  let outcome: ResolveResult["outcome"];

  if (aliveNow === 1) {
    const winner = await Entry.findOne({ gameId: game._id, status: "alive" });
    if (winner) {
      winner.status = "winner";
      await winner.save();
      game.winnerUserId = winner.userId;
    }
    game.status = "finished";
    game.finishedAt = new Date();
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
    // Pre-load next matchday fixtures so the new deadline is known.
    try {
      await syncFixtures(game.season, md + 1);
    } catch {
      /* non-fatal — will retry on next resolve */
    }
  }
  await game.save();

  return { complete: true, matchday: md, outcome, eliminated, aliveNow };
}
