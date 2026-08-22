// How a pick reads against its fixture — the one place that rule lives.
//
// The resolver writes results from it (lib/game/resolve.ts), and the portal
// reads a live verdict from it mid-week without writing anything. Same
// function both times, so "you're safe" on the dashboard can never disagree
// with what the resolution goes on to record.

import type { PickResult } from "@/models/Game/Pick";
import type { LivePickState } from "./portalTypes";
import { UNPLAYABLE_STATUSES, DECIDED_STATUSES } from "./constants";

/** The parts of a pick that decide its fate. */
export interface ScorablePick {
  teamApiId: number | null;
  isWildcard: boolean;
}

/** The parts of a fixture that decide a pick's fate. */
export interface ScorableFixture {
  homeTeamApiId: number;
  awayTeamApiId: number;
  status: string;
  winner: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

/**
 * A decided fixture's verdict on a pick.
 *
 * The wildcard protects the pick: a draw is enough to go through, so only a
 * loss knocks a wildcard player out.
 */
export function scoreDecidedPick(
  fixture: ScorableFixture,
  pick: ScorablePick
): { result: PickResult; survives: boolean } {
  const isHome = fixture.homeTeamApiId === pick.teamApiId;
  const won =
    (fixture.winner === "HOME_TEAM" && isHome) || (fixture.winner === "AWAY_TEAM" && !isHome);
  const drew = fixture.winner === "DRAW";

  if (won) return { result: "win", survives: true };
  if (drew && pick.isWildcard) return { result: "draw", survives: true };
  return { result: drew ? "draw" : "loss", survives: false };
}

/** Whether a fixture has a final result to score against. */
export function isDecided(fixture: ScorableFixture): boolean {
  return DECIDED_STATUSES.includes(fixture.status) && !!fixture.winner;
}

/**
 * Live state of a pick, mid-week: already safe, already gone, or still to be
 * settled. "safe"/"out" are certainties — the resolver will write the same
 * verdict — so they can be shown as fact before the week resolves.
 */
export type { LivePickState };

export interface LivePick {
  state: LivePickState;
  /** The result the resolver would write right now. */
  result: PickResult;
}

/**
 * Read a pick's live state off its fixture.
 *
 * `null` for either means the week can't go against them: a player with no
 * pick is only out once the resolver says so (it assigns one first), and a
 * pick stranded on a fixture that won't be played scores safe.
 */
export function livePickState(
  pick: ScorablePick | null,
  fixture: ScorableFixture | null | undefined
): LivePick {
  if (!pick) return { state: "pending", result: "pending" };
  // A teamless legacy wildcard skips the week outright.
  if (pick.isWildcard && pick.teamApiId == null) return { state: "safe", result: "safe" };
  if (!fixture) return { state: "pending", result: "pending" };
  if (UNPLAYABLE_STATUSES.includes(fixture.status)) {
    return { state: "safe", result: "postponed" };
  }
  if (!isDecided(fixture)) return { state: "pending", result: "pending" };

  const { result, survives } = scoreDecidedPick(fixture, pick);
  return { state: survives ? "safe" : "out", result };
}

/** The state a already-written result carries. */
export function stateOfResult(result: PickResult, isWildcard: boolean): LivePickState {
  switch (result) {
    case "win":
    case "safe":
    case "postponed":
      return "safe";
    case "draw":
      return isWildcard ? "safe" : "out";
    case "loss":
      return "out";
    default:
      return "pending";
  }
}

/**
 * Where a pick stands, from whichever source knows: a resolved week has its
 * result written down, and an unresolved one is read off the fixture.
 */
export function pickState(
  pick: ScorablePick & { result: PickResult },
  fixture: ScorableFixture | null | undefined
): LivePickState {
  return pick.result === "pending"
    ? livePickState(pick, fixture).state
    : stateOfResult(pick.result, pick.isWildcard);
}

/** One line on where a pick stands, for the player looking at it. */
export function liveDetail(
  live: LivePick,
  opts: { teamName?: string | null; isWildcard?: boolean; score?: string | null }
): string {
  const team = opts.teamName ?? "Your team";
  const score = opts.score ? ` ${opts.score}` : "";
  switch (live.result) {
    case "win":
      return `${team} won${score}. You’re through to next week.`;
    case "draw":
      return opts.isWildcard
        ? `${team} drew${score} — your wildcard keeps you in.`
        : `${team} drew${score}. That’s you out.`;
    case "loss":
      return `${team} lost${score}. That’s you out.`;
    case "postponed":
      return `${team}’s match won’t be played, so you’re safe this week.`;
    case "safe":
      return "Wildcard played — you sit this week out safely.";
    default:
      return `${team} still to play. Win and you’re through.`;
  }
}
