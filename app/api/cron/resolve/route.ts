import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentGame } from "@/lib/game/queries";
import { resolveMatchday, autoPickForMatchday } from "@/lib/game/resolve";
import { syncSeasonFixtures } from "@/lib/football-api/sync";
import { DEFAULT_SEASON } from "@/lib/game/constants";
import { errorResponse } from "@/lib/api";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * The game's heartbeat — fire every ~15 minutes from a scheduler with
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Each tick: refresh the season's fixtures → auto-pick for anyone who missed
 * the deadline → resolve the matchday once its fixtures are done. Every step
 * is idempotent and lease-guarded, so overlapping or repeated ticks are safe.
 * (GET because common schedulers, including Vercel Cron, invoke with GET.)
 */
async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const game = await getCurrentGame();
    const season = game?.season ?? DEFAULT_SEASON;

    let synced = 0;
    try {
      synced = await syncSeasonFixtures(season);
    } catch (err) {
      // API hiccup — carry on with stored fixtures; the next tick retries.
      console.warn("[cron] fixture sync failed:", (err as Error).message);
    }

    if (!game || game.status !== "active") {
      return NextResponse.json({ ok: true, synced, message: "No active game." });
    }

    const autoPicked = await autoPickForMatchday(game, game.currentMatchday);
    const result = await resolveMatchday(String(game._id), { skipSync: true });
    return NextResponse.json({ ok: true, synced, autoPicked, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
