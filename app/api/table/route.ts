import { NextResponse } from "next/server";
import { getLeagueTable } from "@/lib/game/browse";
import { errorResponse } from "@/lib/api";

// The Premier League table for the current season. Public — read-only
// football data, no game or player state.
export async function GET() {
  try {
    const table = await getLeagueTable();
    return NextResponse.json(table);
  } catch (err) {
    return errorResponse(err);
  }
}
