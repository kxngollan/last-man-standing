import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getLeagueTable } from "@/lib/game/browse";
import { errorResponse } from "@/lib/api";

// The Premier League table for the current season (players only).
export async function GET() {
  try {
    await requireUser();
    const table = await getLeagueTable();
    return NextResponse.json(table);
  } catch (err) {
    return errorResponse(err);
  }
}
