import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { syncTeams, syncFixtures } from "@/lib/football-api/sync";
import { readJson, errorResponse } from "@/lib/api";
import { DEFAULT_SEASON } from "@/lib/game/constants";

const seedSchema = z
  .object({
    season: z.number().int().min(2020).max(2100).optional(),
    matchday: z.number().int().min(1).max(38).optional(),
  })
  .strict();

// Seed the Premier League teams (and optionally a matchday's fixtures) from football-data.org.
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = seedSchema.safeParse((await readJson(request)) ?? {});
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid season or matchday." }, { status: 400 });
    }
    const { season = DEFAULT_SEASON, matchday } = parsed.data;
    const teams = await syncTeams(season);
    let fixtures: number | undefined;
    if (matchday) fixtures = await syncFixtures(season, matchday);
    return NextResponse.json({ ok: true, teams, fixtures });
  } catch (err) {
    return errorResponse(err);
  }
}
