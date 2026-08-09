import { Fixture } from "@/models/Teams/Fixture";

/** The pick deadline for a matchday = kickoff of its earliest fixture. */
export async function getMatchdayDeadline(
  season: number,
  matchday: number
): Promise<Date | null> {
  const first = await Fixture.findOne({ season, matchday })
    .sort({ utcKickoff: 1 })
    .lean();
  return first?.utcKickoff ? new Date(first.utcKickoff) : null;
}

export function isLocked(deadline: Date | null, now: Date = new Date()): boolean {
  return !!deadline && now.getTime() >= deadline.getTime();
}
