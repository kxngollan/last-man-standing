import { connectDB } from "@/database/connect";
import { Team } from "@/models/Teams/Team";
import { Fixture, type FixtureStatus, type FixtureWinner } from "@/models/Teams/Fixture";
import { fetchPLTeams, fetchPLMatchday, fetchPLSeasonMatches, type FdMatch } from "./client";
import { pixelCrestPath } from "@/lib/crests";

/** Upsert a batch of API matches into the Fixture collection. */
async function upsertMatches(season: number, matches: FdMatch[]): Promise<number> {
  if (matches.length === 0) return 0;
  await Fixture.bulkWrite(
    matches.map((m) => ({
      updateOne: {
        filter: { apiId: m.id },
        update: {
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
        upsert: true,
      },
    }))
  );
  return matches.length;
}

/** Fetch the Premier League teams and upsert them into the Team collection. */
export async function syncTeams(season?: number): Promise<number> {
  await connectDB();
  const teams = await fetchPLTeams(season);
  if (teams.length === 0) return 0;
  await Team.bulkWrite(
    teams.map((t) => ({
      updateOne: {
        filter: { apiId: t.id },
        update: {
          $set: {
            apiId: t.id,
            name: t.name,
            shortName: t.shortName,
            tla: t.tla,
            // Both badges are stored, and nothing here decides between them.
            // `crest` is the club's own, exactly as the API gave it; `pCrest`
            // points at our pixelated copy in public/crests. Which one reaches a
            // screen is CREST_STYLE's call, made when the team is read
            // (lib/game/teams.ts) — so switching it needs no re-sync, and the
            // official URL is never lost by a sync run under the wrong setting.
            crest: t.crest,
            pCrest: pixelCrestPath(t.tla),
          },
        },
        upsert: true,
      },
    }))
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
