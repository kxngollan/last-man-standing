import { NextResponse } from "next/server";
import { getFixturesForMatchday } from "@/lib/game/browse";
import { errorResponse } from "@/lib/api";

// Fixtures for one game week of the current season. Public — read-only
// football data, no game or player state.
// ?matchday=N — omit to get the current/next matchday.
export async function GET(request: Request) {
  try {
    const param = new URL(request.url).searchParams.get("matchday");
    const matchday = param ? Number(param) : undefined;
    // Non-integers fall back to the default week; the range is clamped inside.
    const week = await getFixturesForMatchday(
      matchday !== undefined && Number.isInteger(matchday) ? matchday : undefined
    );
    return NextResponse.json(week);
  } catch (err) {
    return errorResponse(err);
  }
}
