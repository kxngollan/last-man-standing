import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getPickSummary } from "@/lib/game/queries";
import { errorResponse } from "@/lib/api";

// How many players picked each team for the current pick week (players only).
export async function GET() {
  try {
    await requireUser();
    const summary = await getPickSummary();
    if (!summary) {
      return NextResponse.json({ error: "There isn’t a game running." }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (err) {
    return errorResponse(err);
  }
}
