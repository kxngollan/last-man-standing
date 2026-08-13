import { Fixture } from "@/models/Teams/Fixture";
import { PICK_DEADLINE_LEAD_MS } from "./constants";

/**
 * The pick deadline for a matchday: PICK_DEADLINE_LEAD_MS before the kickoff of
 * its earliest fixture.
 *
 * Derived rather than stored, so a fixture being rescheduled moves the deadline
 * with it — including the case where a newly-added earlier kickoff becomes the
 * one that sets it.
 */
export async function getMatchdayDeadline(
  season: number,
  matchday: number
): Promise<Date | null> {
  const first = await Fixture.findOne({ season, matchday })
    .sort({ utcKickoff: 1 })
    .lean();
  if (!first?.utcKickoff) return null;
  return new Date(new Date(first.utcKickoff).getTime() - PICK_DEADLINE_LEAD_MS);
}

export function isLocked(deadline: Date | null, now: Date = new Date()): boolean {
  return !!deadline && now.getTime() >= deadline.getTime();
}
