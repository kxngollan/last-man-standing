import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getCurrentGame } from "@/lib/game/queries";
import { syncFixtures } from "@/lib/football-api/sync";
import { Fixture } from "@/models/Teams/Fixture";
import { INCOMPLETE_STATUSES, DECIDED_STATUSES } from "@/lib/game/constants";
import { errorResponse } from "@/lib/api";

// Pull the current game week's fixtures and results from football-data.org on
// demand. The cron does this on every tick; this is for when an admin needs
// fresh scores now — to check whether a week is ready to resolve, or to fix a
// wrong result the API has since corrected.
export async function POST() {
  try {
    await requireAdmin();
    const game = await getCurrentGame();
    if (!game) {
      return NextResponse.json({ error: "There isn’t a game to sync." }, { status: 409 });
    }
    const matchday = game.currentMatchday;
    const synced = await syncFixtures(game.season, matchday);
    const fixtures = await Fixture.find({ season: game.season, matchday })
      .select("status")
      .lean();
    return NextResponse.json({
      matchday,
      gameWeek: matchday - game.startMatchday + 1,
      synced,
      total: fixtures.length,
      finished: fixtures.filter((f) => DECIDED_STATUSES.includes(f.status)).length,
      playing: fixtures.filter((f) => INCOMPLETE_STATUSES.includes(f.status)).length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
