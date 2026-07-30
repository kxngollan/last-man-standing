// Premier League season (starting year). 2025 = the 2025/26 season.
// Override with PL_SEASON in the environment if needed.
export const DEFAULT_SEASON = Number(process.env.PL_SEASON) || 2025;

export const TEAMS_PER_GAME = 20;

// Fixture statuses that mean the matchday isn't finished playing yet.
export const INCOMPLETE_STATUSES = ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED", "SUSPENDED"];
