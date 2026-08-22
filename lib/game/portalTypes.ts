// Pure types shared between the server query layer and client components.
// No imports — safe to include in the client bundle.

export type GameStatus = "registration" | "active" | "finished";
export type EntryStatus = "alive" | "eliminated" | "winner";
export type PickResult = "pending" | "win" | "draw" | "loss" | "postponed" | "safe";

/**
 * Where a pick stands before the resolver has run. "safe" and "out" are
 * certainties read off a finished fixture — the resolution will say the same —
 * so the portal can state them as fact mid-week. "pending" is everything still
 * to be settled.
 */
export type LivePickState = "safe" | "out" | "pending";

/** Where a game week sits relative to now. */
export type WeekState = "played" | "in-play" | "open";

/** One game week a player can look at — what the week buttons are built from. */
export interface WeekOption {
  matchday: number;
  gameWeek: number;
  state: WeekState;
  /** True once its deadline has passed and its picks are fixed. */
  locked: boolean;
}

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
  /**
   * This player's pick for the one game week the board is showing, or null if
   * they had none (they were already out, or haven't picked yet). The board is
   * always scoped to a single week — a row that mixed weeks, or showed a
   * player's newest pick whatever week it was for, is how a week-2 pick ends
   * up reading as this week's team.
   */
  pick: StandingPick | null;
  /** `pick`, flattened — kept for older clients. */
  lastTeamTla: string | null;
  lastTeamName: string | null;
  lastTeamCrest: string | null;
}

/** One of a standings row's picks, tied to the week it's for. */
export interface StandingPick {
  matchday: number;
  gameWeek: number;
  teamName: string | null;
  tla: string | null;
  crest: string | null;
  isWildcard: boolean;
  /** Where it stands: settled by a result, or still to be played out. */
  state: LivePickState;
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
  /**
   * Which week this board is: one already played out, the one being played
   * now, or a later one still open for picks. Boards are per-week — one screen
   * never mixes two.
   */
  state: WeekState;
  /** True once this week's deadline has passed and its picks are fixed. */
  locked: boolean;
  /**
   * How this board's players stand relative to its week. On the in-play week
   * that's their result so far; on an open week it's whether they're already
   * guaranteed to be in it ("safe") or could still be knocked out of the week
   * being played first ("pending").
   */
  counts: { safe: number; pending: number; out: number };
  /**
   * Picks left off the board because their player is already out of the game
   * (or out of the week being played), so they can't be in this week at all.
   */
  excluded: number;
  teams: Array<{
    teamApiId: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string | null;
    count: number;
    /** Public display names ("Sam K.") of the players on this team. */
    players: string[];
    /** The same players with their live state — only when the caller asks. */
    roster?: Array<{ name: string; state: LivePickState }>;
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
  /**
   * Where the player stands in the week being played, read live off the
   * fixtures rather than waiting for the resolution. Null when there's no
   * entry, or when that week hasn't been picked yet.
   */
  liveWeek: {
    matchday: number;
    gameWeek: number;
    teamName: string | null;
    tla: string | null;
    crest: string | null;
    isWildcard: boolean;
    state: LivePickState;
    /** One line on where the pick stands, ready to show. */
    detail: string;
    /** Their fixture's kickoff (ISO) while it's still to come. */
    kickoff: string | null;
    /** The score so far / final, e.g. "2–0", when there is one. */
    score: string | null;
  } | null;
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
