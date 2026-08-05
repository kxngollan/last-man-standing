// Pure types shared between the server query layer and client components.
// No imports — safe to include in the client bundle.

export type GameStatus = "registration" | "active" | "finished";
export type EntryStatus = "alive" | "eliminated" | "winner";

export interface TeamOption {
  apiId: number;
  name: string;
  shortName: string;
  tla: string;
  crest?: string;
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
  standings: Array<{
    name: string;
    you: boolean;
    survivedWeeks: number;
    status: EntryStatus;
    lastTeamTla: string | null;
    lastTeamName: string | null;
    lastTeamCrest: string | null;
  }>;
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
