// Thin client for football-data.org (v4). Premier League competition code is "PL".
// Free tier is rate-limited (~10 req/min) — callers cache results into the DB.

const BASE = "https://api.football-data.org/v4";

export interface FdTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface FdMatch {
  id: number;
  matchday: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
  };
}

async function fd<T>(path: string): Promise<T> {
  const key = process.env.FOOTBALL_API;
  if (!key) throw new Error("FOOTBALL_API is not set. Add it to .env.local.");
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Auth-Token": key },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`football-data.org request failed (${res.status}) for ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPLTeams(season?: number): Promise<FdTeam[]> {
  const q = season ? `?season=${season}` : "";
  const data = await fd<{ teams: FdTeam[] }>(`/competitions/PL/teams${q}`);
  return data.teams ?? [];
}

export async function fetchPLMatchday(season: number, matchday: number): Promise<FdMatch[]> {
  const data = await fd<{ matches: FdMatch[] }>(
    `/competitions/PL/matches?season=${season}&matchday=${matchday}`
  );
  return data.matches ?? [];
}
