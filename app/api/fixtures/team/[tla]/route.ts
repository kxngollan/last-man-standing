import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getFixturesForTeam } from "@/lib/game/browse";
import { errorResponse } from "@/lib/api";

// One club's season fixtures — next game, upcoming, and results (players only).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tla: string }> }
) {
  try {
    await requireUser();
    const { tla } = await params;
    const team = await getFixturesForTeam(tla);
    if (!team) {
      return NextResponse.json({ error: "Unknown team." }, { status: 404 });
    }
    return NextResponse.json(team);
  } catch (err) {
    return errorResponse(err);
  }
}
