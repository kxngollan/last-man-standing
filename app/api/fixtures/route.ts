import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getFixturesForMatchday } from "@/lib/game/browse";
import { errorResponse } from "@/lib/api";

// Fixtures for one game week of the current season (players only).
// ?matchday=N — omit to get the current/next matchday.
export async function GET(request: Request) {
  try {
    await requireUser();
    const param = new URL(request.url).searchParams.get("matchday");
    const matchday = param ? Number(param) : undefined;
    const week = await getFixturesForMatchday(
      matchday !== undefined && Number.isFinite(matchday) ? matchday : undefined
    );
    return NextResponse.json(week);
  } catch (err) {
    return errorResponse(err);
  }
}
