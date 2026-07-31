import { connectDB } from "@/database/connect";
import { Team } from "@/models/Team";
import { Fixture, type FixtureStatus, type FixtureWinner } from "@/models/Fixture";
import { fetchPLTeams, fetchPLMatchday, fetchPLSeasonMatches, type FdMatch } from "./client";

/** Upsert a batch of API matches into the Fixture collection. */
async function upsertMatches(season: number, matches: FdMatch[]): Promise<number> {
  await Promise.all(
    matches.map((m) =>
      Fixture.updateOne(
        { apiId: m.id },
        {
          $set: {
            apiId: m.id,
            season,
            matchday: m.matchday,
            homeTeamApiId: m.homeTeam.id,
            awayTeamApiId: m.awayTeam.id,
            utcKickoff: new Date(m.utcDate),
            status: m.status as FixtureStatus,
            homeScore: m.score.fullTime.home,
            awayScore: m.score.fullTime.away,
            winner: (m.score.winner ?? null) as FixtureWinner,
          },
        },
        { upsert: true }
      )
    )
  );
  return matches.length;
}

/** Fetch the Premier League teams and upsert them into the Team collection. */
export async function syncTeams(season?: number): Promise<number> {
  await connectDB();
  const teams = await fetchPLTeams(season);
  await Promise.all(
    teams.map((t) =>
      Team.updateOne(
        { apiId: t.id },
        { $set: { apiId: t.id, name: t.name, shortName: t.shortName, tla: t.tla, crest: t.crest } },
        { upsert: true }
      )
    )
  );
  return teams.length;
}

/** Fetch one matchday's fixtures/results and upsert them into the Fixture collection. */
export async function syncFixtures(season: number, matchday: number): Promise<number> {
  await connectDB();
  const matches = await fetchPLMatchday(season, matchday);
  return upsertMatches(season, matches);
}

/** Fetch and upsert every fixture in a season (all matchdays) in one API call. */
export async function syncSeasonFixtures(season: number): Promise<number> {
  await connectDB();
  const matches = await fetchPLSeasonMatches(season);
  return upsertMatches(season, matches);
}
