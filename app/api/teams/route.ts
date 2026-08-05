import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getTeams } from "@/lib/game/browse";
import { errorResponse } from "@/lib/api";

// All clubs, A–Z — powers the by-team picker on the fixtures page (players only).
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await getTeams());
  } catch (err) {
    return errorResponse(err);
  }
}
