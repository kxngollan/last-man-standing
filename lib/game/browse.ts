import { connectDB } from "@/database/connect";
import { Team } from "@/models/Teams/Team";
import { Fixture, type IFixture } from "@/models/Teams/Fixture";
import { syncSeasonFixtures } from "@/lib/football-api/sync";
import { acquireLock, releaseLock } from "@/lib/locks";
import { DEFAULT_SEASON, TOTAL_MATCHDAYS, INCOMPLETE_STATUSES } from "./constants";
import { getCurrentGame } from "./queries";
import type {
  LeagueTable,
  FixturesWeek,
  FixtureRow,
  FixtureState,
  TeamInfo,
  TeamFixtures,
} from "./portalTypes";

/** The season players browse: the current game's season, or the configured default. */
async function browseSeason(): Promise<number> {
  const game = await getCurrentGame();
  return game?.season ?? DEFAULT_SEASON;
}

type TeamTally = {
  apiId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Finished results in kickoff order, most recent last: "W" | "D" | "L". */
  form: { kickoff: number; result: "W" | "D" | "L" }[];
};

/**
 * The Premier League table for the browsed season, built from our own fixture
 * results (the same source the Fixtures view reads) and ranked by the official
 * Premier League rules, in order:
 *   1. Points (3 for a win, 1 for a draw)
 *   2. Goal difference
 *   3. Goals scored
 *   4. Team name (A–Z) — a deterministic fallback for display. The Premier
 *      League leaves teams level here unless a title/relegation/qualification
 *      place is at stake (then a play-off decides); it does NOT use head-to-head.
 * Only FINISHED fixtures count toward the standings.
 */
export async function getLeagueTable(): Promise<LeagueTable> {
  await connectDB();
  const season = await browseSeason();
  await ensureSeasonFixtures(season);

  const [fixtures, teams] = await Promise.all([
    Fixture.find({ season }).lean<IFixture[]>(),
    Team.find({}).lean(),
  ]);
  const teamById = new Map(teams.map((t) => [t.apiId, t]));

  const tallies = new Map<number, TeamTally>();
  const tally = (apiId: number): TeamTally => {
    let t = tallies.get(apiId);
    if (!t) {
      t = { apiId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] };
      tallies.set(apiId, t);
    }
    return t;
  };

  // Every club that appears in the season's fixtures belongs in the table, even
  // before it has played — so the full 20 show up with zeroes from game week 1.
  for (const f of fixtures) {
    tally(f.homeTeamApiId);
    tally(f.awayTeamApiId);
  }

  for (const f of fixtures) {
    if (f.status !== "FINISHED" || f.homeScore == null || f.awayScore == null) continue;
    const home = tally(f.homeTeamApiId);
    const away = tally(f.awayTeamApiId);
    const kickoff = new Date(f.utcKickoff).getTime();

    home.played++;
    away.played++;
    home.goalsFor += f.homeScore;
    home.goalsAgainst += f.awayScore;
    away.goalsFor += f.awayScore;
    away.goalsAgainst += f.homeScore;

    if (f.homeScore > f.awayScore) {
      home.won++;
      home.points += 3;
      away.lost++;
      home.form.push({ kickoff, result: "W" });
      away.form.push({ kickoff, result: "L" });
    } else if (f.homeScore < f.awayScore) {
      away.won++;
      away.points += 3;
      home.lost++;
      away.form.push({ kickoff, result: "W" });
      home.form.push({ kickoff, result: "L" });
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
      home.form.push({ kickoff, result: "D" });
      away.form.push({ kickoff, result: "D" });
    }
  }

  const nameOf = (apiId: number) => teamById.get(apiId)?.name ?? "";

  const ranked = [...tallies.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return nameOf(a.apiId).localeCompare(nameOf(b.apiId));
  });

  return {
    season,
    updatedAt: new Date().toISOString(),
    rows: ranked.map((t, i) => {
      const meta = teamById.get(t.apiId);
      const form = t.form
        .slice()
        .sort((x, y) => x.kickoff - y.kickoff)
        .slice(-5)
        .map((r) => r.result)
        .join(",");
      return {
        position: i + 1,
        name: meta?.name ?? "TBD",
        shortName: meta?.shortName ?? "TBD",
        tla: meta?.tla ?? "",
        crest: meta?.crest ?? null,
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        goalDifference: t.goalsFor - t.goalsAgainst,
        points: t.points,
        form: form || null,
      };
    }),
  };
}

/**
 * Bootstrap for a cold database only — the cron keeps fixtures fresh. When the
 * season has no fixtures at all, exactly one caller syncs (lease-guarded);
 * concurrent first requests render empty once instead of stampeding the
 * rate-limited football API.
 */
async function ensureSeasonFixtures(season: number): Promise<void> {
  const have = await Fixture.countDocuments({ season });
  if (have > 0) return;
  const lock = `sync:season:${season}`;
  if (!(await acquireLock(lock, 60_000))) return;
  try {
    await syncSeasonFixtures(season);
  } catch {
    /* non-fatal — the views render empty until fixtures load */
  } finally {
    await releaseLock(lock);
  }
}

/** The matchday to show by default: the live game's, else the first unfinished week. */
async function defaultMatchday(season: number, fixtures: IFixture[]): Promise<number> {
  const game = await getCurrentGame();
  if (game && game.season === season) return game.currentMatchday;
  const incomplete = fixtures.filter((f) => INCOMPLETE_STATUSES.includes(f.status));
  if (incomplete.length) return Math.min(...incomplete.map((f) => f.matchday));
  return fixtures.length ? Math.max(...fixtures.map((f) => f.matchday)) : 1;
}

function fixtureState(status: string): { state: FixtureState; label: string } {
  if (status === "FINISHED") return { state: "finished", label: "FT" };
  if (status === "IN_PLAY" || status === "PAUSED") return { state: "live", label: "LIVE" };
  if (status === "POSTPONED" || status === "CANCELLED" || status === "SUSPENDED") {
    return { state: "postponed", label: "PP" };
  }
  return { state: "scheduled", label: "" }; // client formats the kickoff time
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type SideOf = (apiId: number) => FixtureRow["home"];

/** Build the `side` lookup and row mapper shared by the fixtures views. */
function rowMapper(teams: { apiId: number; name: string; shortName: string; tla: string; crest?: string }[]): {
  side: SideOf;
  toRow: (f: IFixture) => FixtureRow;
} {
  const teamById = new Map(teams.map((t) => [t.apiId, t]));
  const side: SideOf = (apiId: number) => {
    const t = teamById.get(apiId);
    return {
      name: t?.name ?? "TBD",
      shortName: t?.shortName ?? "TBD",
      tla: t?.tla ?? "",
      crest: t?.crest ?? null,
    };
  };
  const toRow = (f: IFixture): FixtureRow => {
    const { state, label } = fixtureState(f.status);
    return {
      apiId: f.apiId,
      matchday: f.matchday,
      kickoff: new Date(f.utcKickoff).toISOString(),
      state,
      statusLabel: label,
      home: side(f.homeTeamApiId),
      away: side(f.awayTeamApiId),
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      winner: f.winner,
    };
  };
  return { side, toRow };
}

/** Fixtures for one matchday of the browsed season, with team names and crests. */
export async function getFixturesForMatchday(matchday?: number): Promise<FixturesWeek> {
  await connectDB();
  const season = await browseSeason();
  await ensureSeasonFixtures(season);

  const [all, teams] = await Promise.all([
    Fixture.find({ season }).lean<IFixture[]>(),
    Team.find({}).lean(),
  ]);
  const { toRow } = rowMapper(teams);

  const currentMatchday = await defaultMatchday(season, all);
  const md = clamp(matchday ?? currentMatchday, 1, TOTAL_MATCHDAYS);

  const fixtures: FixtureRow[] = all
    .filter((f) => f.matchday === md)
    .sort((a, b) => new Date(a.utcKickoff).getTime() - new Date(b.utcKickoff).getTime())
    .map(toRow);

  return { season, matchday: md, currentMatchday, totalMatchdays: TOTAL_MATCHDAYS, fixtures };
}

/** All clubs of the browsed season, A–Z — for the by-team picker. */
export async function getTeams(): Promise<TeamInfo[]> {
  await connectDB();
  const teams = await Team.find({}).sort({ name: 1 }).lean();
  return teams.map((t) => ({
    name: t.name,
    shortName: t.shortName,
    tla: t.tla,
    crest: t.crest ?? null,
  }));
}

/**
 * One club's season, split around its next meaningful game: the live fixture
 * (or next scheduled one) up top, the rest still to play, and finished games
 * most recent first. Returns null for an unknown TLA.
 */
export async function getFixturesForTeam(tla: string): Promise<TeamFixtures | null> {
  await connectDB();
  const season = await browseSeason();
  await ensureSeasonFixtures(season);

  const [team, teams] = await Promise.all([
    Team.findOne({ tla: tla.toUpperCase() }).lean(),
    Team.find({}).lean(),
  ]);
  if (!team) return null;

  const all = await Fixture.find({
    season,
    $or: [{ homeTeamApiId: team.apiId }, { awayTeamApiId: team.apiId }],
  }).lean<IFixture[]>();

  const { toRow } = rowMapper(teams);
  const rows = all
    .sort((a, b) => new Date(a.utcKickoff).getTime() - new Date(b.utcKickoff).getTime())
    .map(toRow);

  const live = rows.find((r) => r.state === "live");
  const next = live ?? rows.find((r) => r.state === "scheduled") ?? null;
  const upcoming = rows.filter((r) => r.state !== "finished" && r !== next);
  const past = rows.filter((r) => r.state === "finished").reverse();

  return {
    season,
    team: {
      name: team.name,
      shortName: team.shortName,
      tla: team.tla,
      crest: team.crest ?? null,
    },
    next,
    upcoming,
    past,
  };
}
