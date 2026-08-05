import { NextResponse } from "next/server";
import { getTeams } from "@/lib/game/browse";
import { errorResponse } from "@/lib/api";

// All clubs, A–Z — powers the by-team picker on the fixtures page. Public.
export async function GET() {
  try {
    return NextResponse.json(await getTeams());
  } catch (err) {
    return errorResponse(err);
  }
}
