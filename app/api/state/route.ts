import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getGameStateForUser } from "@/lib/game/queries";
import { errorResponse } from "@/lib/api";

// Portal state for the signed-in user (current game, teams, standings, history).
export async function GET() {
  try {
    const user = await requireUser();
    const state = await getGameStateForUser(user.id);
    return NextResponse.json(state);
  } catch (err) {
    return errorResponse(err);
  }
}
