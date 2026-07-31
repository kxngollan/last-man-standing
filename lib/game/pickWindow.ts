import { Fixture } from "@/models/Fixture";
import { syncFixtures } from "@/lib/football-api/sync";
import { getMatchdayDeadline, isLocked } from "./deadline";
import { TOTAL_MATCHDAYS } from "./constants";

/** Make sure a matchday's fixtures are in the DB, fetching them once if missing. */
export async function ensureMatchdayFixtures(season: number, matchday: number): Promise<void> {
  const count = await Fixture.countDocuments({ season, matchday });
  if (count === 0) {
    try {
      await syncFixtures(season, matchday);
    } catch {
      /* non-fatal — the deadline just stays unknown until fixtures load */
    }
  }
}

export interface PickWindow {
  /** The game week a player picks for. */
  matchday: number;
  /** Deadline (first kickoff) for that matchday, or null if not yet known. */
  deadline: Date | null;
  /** Whether that matchday has already kicked off (so nothing is pickable). */
  locked: boolean;
  /** True when the pick week is beyond the current in-play week (picking ahead). */
  ahead: boolean;
}

/**
 * The week a player can pick for: the current matchday, or — once that week
 * has kicked off — the next game week, however far ahead in time it sits.
 * Looks at most one week ahead (players pick the next week only). Ensures the
 * chosen week's fixtures are loaded so its teams and deadline are available.
 */
export async function getPickWindow(season: number, currentMatchday: number): Promise<PickWindow> {
  await ensureMatchdayFixtures(season, currentMatchday);
  const currentDeadline = await getMatchdayDeadline(season, currentMatchday);

  // Current week hasn't kicked off — pick it as normal.
  if (!isLocked(currentDeadline)) {
    return { matchday: currentMatchday, deadline: currentDeadline, locked: false, ahead: false };
  }

  // Current week has locked. Offer the next week in advance, if there is one.
  const next = currentMatchday + 1;
  if (next > TOTAL_MATCHDAYS) {
    return { matchday: currentMatchday, deadline: currentDeadline, locked: true, ahead: false };
  }
  await ensureMatchdayFixtures(season, next);
  const nextDeadline = await getMatchdayDeadline(season, next);
  return { matchday: next, deadline: nextDeadline, locked: isLocked(nextDeadline), ahead: true };
}
