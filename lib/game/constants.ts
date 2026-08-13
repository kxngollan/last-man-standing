// Premier League season (starting year). 2025 = the 2025/26 season.
// Override with PL_SEASON in the environment if needed.
export const DEFAULT_SEASON = Number(process.env.PL_SEASON) || 2025;

export const TEAMS_PER_GAME = 20;

// A Premier League season is always 38 matchdays (20 teams, home and away).
export const TOTAL_MATCHDAYS = 38;

/**
 * How long before the game week's first kickoff picks stop being accepted.
 *
 * The deadline used to be that kickoff itself, which left no margin: a player
 * submitting on the whistle raced the cron that auto-picks for everyone who
 * hadn't, and team news for the early game was already out. An hour's lead
 * closes both gaps.
 */
export const PICK_DEADLINE_LEAD_MS = 60 * 60 * 1000; // 1 hour

// Fixture statuses that mean the matchday isn't finished playing yet.
export const INCOMPLETE_STATUSES = ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED", "SUSPENDED"];

// Fixtures that won't produce a result this game week — auto-picks avoid
// their teams, and picks stranded on them resolve as safe.
export const UNPLAYABLE_STATUSES = ["POSTPONED", "CANCELLED", "SUSPENDED"];

// A decided fixture has a final result: played to full time, or awarded by
// the league (e.g. a forfeit) — an awarded winner eliminates like a real one.
export const DECIDED_STATUSES = ["FINISHED", "AWARDED"];
