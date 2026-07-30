import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { syncTeams, syncFixtures } from "@/lib/football-api/sync";
import { readJson, errorResponse } from "@/lib/api";
import { DEFAULT_SEASON } from "@/lib/game/constants";

// Seed the Premier League teams (and optionally a matchday's fixtures) from football-data.org.
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readJson<{ season?: number; matchday?: number }>(request);
    const season = body?.season ?? DEFAULT_SEASON;
    const teams = await syncTeams(season);
    let fixtures: number | undefined;
    if (body?.matchday) fixtures = await syncFixtures(season, body.matchday);
    return NextResponse.json({ ok: true, teams, fixtures });
  } catch (err) {
    return errorResponse(err);
  }
}
