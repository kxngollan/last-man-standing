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
  }>;
  history: Array<{
    matchday: number;
    gameWeek: number;
    teamName: string | null;
    tla: string | null;
    result: string;
    isWildcard: boolean;
  }>;
}
