// Pure types shared between the server query layer and client components.
// No imports — safe to include in the client bundle.

export type GameStatus = "registration" | "active" | "finished";
export type EntryStatus = "alive" | "eliminated" | "winner";
export type PickResult = "pending" | "win" | "draw" | "loss" | "postponed" | "safe";

export interface TeamOption {
  apiId: number;
  name: string;
  shortName: string;
  tla: string;
  /** Null when there is no badge to show — see lib/crests.ts. */
  crest?: string | null;
  opponent: string;
  venue: "H" | "A";
  fixtureApiId: number;
  used: boolean;
}

/** One row of the Premier League table. */
export interface LeagueRow {
  position: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Recent results, most recent last, e.g. "W,W,D,L,W" — may be null. */
  form: string | null;
}

export interface LeagueTable {
  season: number;
  updatedAt: string;
  rows: LeagueRow[];
}

export type FixtureState = "scheduled" | "live" | "finished" | "postponed";

/** One fixture in the browsable fixtures view. */
export interface FixtureRow {
  apiId: number;
  matchday: number;
  kickoff: string; // ISO
  state: FixtureState;
  statusLabel: string; // human label, e.g. "FT", "19:00", "Postponed"
  home: { name: string; shortName: string; tla: string; crest: string | null };
  away: { name: string; shortName: string; tla: string; crest: string | null };
  homeScore: number | null;
  awayScore: number | null;
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}

export interface FixturesWeek {
  season: number;
  matchday: number;
  currentMatchday: number;
  totalMatchdays: number;
  fixtures: FixtureRow[];
}

/** A club, as shown in team pickers and the by-team fixtures view. */
export interface TeamInfo {
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
}

/** A single club's season, split around its next meaningful game. */
export interface TeamFixtures {
  season: number;
  team: TeamInfo;
  /** The live game if one is on, else the next scheduled fixture. */
  next: FixtureRow | null;
  /** Everything still to play after `next`, kickoff order (includes postponed). */
  upcoming: FixtureRow[];
  /** Finished games, most recent first. */
  past: FixtureRow[];
}

/**
 * What kind of problem a report is about.
 *
 * Here rather than only on the Mongoose model because the mobile app needs it
 * too, and this file is the one it can see — `@shared/portalTypes` is the whole
 * of what Metro resolves outside the app folder. It must stay in step with the
 * enum in models/Report/IssueReport.ts and issueSchema in lib/validation.ts.
 */
export type IssueCategory = "bug" | "scores" | "account" | "player" | "other";

/** One issue report in the admin Issues panel. */
export interface AdminIssueRow {
  id: string;
  category: IssueCategory;
  message: string;
  page: string;
  status: "open" | "resolved";
  user: { name: string; email: string };
  createdAt: string;
}

/** The admin Issues panel payload. */
export interface AdminIssueList {
  openCount: number;
  rows: AdminIssueRow[];
}

/** One feedback entry in the admin Feedback panel. */
export interface AdminFeedbackRow {
  id: string;
  rating: number;
  message: string;
  user: { name: string; email: string };
  createdAt: string;
}

/** The admin Feedback panel payload. */
export interface AdminFeedbackList {
  count: number;
  averageRating: number | null;
  rows: AdminFeedbackRow[];
}

/** One player row in the admin Players panel. */
export interface AdminUserRow {
  id: string;
  /** Prefilled from the legacy `name` split for pre-split accounts. */
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  /** Referral fields — only the list endpoint fills these in. */
  referralHandle?: string;
  /** Public name of whoever brought them in, if anyone. */
  referredBy?: string | null;
  /** Confirmed referrals they've made. */
  referrals?: number;
}

export interface AdminOverview {
  current: {
    id: string;
    no: number;
    status: GameStatus;
    season: number;
    matchday: number;
    gameWeek: number;
    playersTotal: number;
    playersAlive: number;
    deadline: string | null;
    locked: boolean;
  } | null;
  pastGames: Array<{
    no: number;
    outcome: string;
    tone: "safe" | "out";
    weeks: number;
  }>;
  teamsSeeded: number;
  /**
   * The last resolution the admin can undo, if any. Present even when the
   * resolution finished the game (and so left `current` null) — that's the
   * accident most worth reversing.
   */
  recovery: {
    gameId: string;
    no: number;
    /** The game week that would go back into play. */
    gameWeek: number;
    matchday: number;
    /** True when that resolution also ended the game. */
    endedGame: boolean;
  } | null;
}

/** One row of the game standings, ranked server-side. */
export interface StandingRow {
  rank: number;
  name: string;
  /** The player behind the row — the board links each name to their profile. */
  userId: string;
  you: boolean;
  survivedWeeks: number;
  status: EntryStatus;
  lastTeamTla: string | null;
  lastTeamName: string | null;
  lastTeamCrest: string | null;
}

/** A page of standings — the board loads these lazily as the player scrolls. */
export interface StandingsPage {
  total: number;
  offset: number;
  rows: StandingRow[];
}

/** Live pick counts for the current pick week — and who's behind each one. */
export interface PickSummary {
  gameWeek: number;
  matchday: number;
  totalPicks: number;
  teams: Array<{
    teamApiId: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string | null;
    count: number;
    /** Public display names ("Sam K.") of the players on this team. */
    players: string[];
  }>;
}

export interface PortalState {
  game: {
    id: string;
    no: number;
    status: GameStatus;
    season: number;
    matchday: number;
    gameWeek: number;
  } | null;
  entry: {
    status: EntryStatus;
    wildcardUsed: boolean;
    survivedWeeks: number;
  } | null;
  deadline: string | null;
  locked: boolean;
  /** The game week players can pick for right now (the current week, or the next one once it locks). */
  pickMatchday: number;
  pickGameWeek: number;
  /** True when the pick week is ahead of the in-play week (picking in advance). */
  pickAhead: boolean;
  players: { total: number; alive: number };
  teams: TeamOption[];
  myPick: {
    teamApiId: number | null;
    teamName: string | null;
    isWildcard: boolean;
    result: string;
  } | null;
  /** First page only — fetch more from /api/standings (see StandingsPage). */
  standings: StandingRow[];
  /** Total entries in the game, so the client knows how many pages remain. */
  standingsTotal: number;
  /** The signed-in player's own row (with true rank) — pinned first in the UI. */
  myStanding: StandingRow | null;
  history: Array<{
    matchday: number;
    gameWeek: number;
    teamName: string | null;
    tla: string | null;
    crest: string | null;
    result: string;
    isWildcard: boolean;
  }>;
}

/* ---- Profiles -----------------------------------------------------------
 * A player's record: the games they've played, the picks behind them and the
 * career totals. Picks for a game week that hasn't started are left out —
 * see lib/game/profile.ts for the rule.
 */

/** One pick on a profile timeline. */
export interface ProfilePick {
  matchday: number;
  gameWeek: number;
  teamName: string | null;
  tla: string | null;
  crest: string | null;
  result: PickResult;
  isWildcard: boolean;
  /** The deadline picked for them — they didn't get one in on time. */
  autoPicked: boolean;
  /** Your own pick for a week nobody's played yet: shown here only to you. */
  hiddenFromOthers: boolean;
}

/** One game in a player's career. */
export interface ProfileGame {
  no: number;
  season: number;
  status: GameStatus;
  /** The game still open — the only one that can hide a pick. */
  isCurrent: boolean;
  entryStatus: EntryStatus;
  survivedWeeks: number;
  /** The game week they went out in, or null if they never did. */
  eliminatedGameWeek: number | null;
  /** Final placing for a finished game, live rank for the open one. */
  rank: number;
  playersTotal: number;
  teamsUsed: number;
  picks: ProfilePick[];
}

/** A team a player leans on, with how often. */
export interface ProfileTeamTally {
  name: string;
  tla: string;
  crest: string | null;
  count: number;
}

/** Career totals, counted from visible picks only. */
export interface ProfileStats {
  gamesPlayed: number;
  wins: number;
  /** Most weeks survived in a single game. */
  bestRun: number;
  totalWeeksSurvived: number;
  /** Mean weeks per game, to one decimal place. */
  averageWeeks: number;
  picksMade: number;
  won: number;
  drawn: number;
  lost: number;
  /** Percentage of decided picks won — null until one has been decided. */
  winRate: number | null;
  wildcardsPlayed: number;
  autoPicks: number;
  /** Most-picked team across the career (teams can't repeat within a game). */
  favouriteTeam: ProfileTeamTally | null;
  /** The team they were on when they went out, most often. */
  nemesisTeam: ProfileTeamTally | null;
}

/** How the viewer's record compares in the games they've both played. */
export interface HeadToHead {
  gamesShared: number;
  viewerAhead: number;
  profileAhead: number;
  level: number;
}

export interface UserProfile {
  id: string;
  /** "Sam K." to everyone else, the full name on your own profile. */
  name: string;
  initials: string;
  /** ISO — when they signed up. */
  memberSince: string;
  isSelf: boolean;
  /** The open game, if they're in it. */
  current: ProfileGame | null;
  /** Finished games, newest first. */
  past: ProfileGame[];
  stats: ProfileStats;
  /** Only when viewing someone else, and only if you've shared a game. */
  headToHead: HeadToHead | null;
}
