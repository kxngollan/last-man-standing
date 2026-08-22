import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getStandingsPage, STANDINGS_PAGE_SIZE } from "@/lib/game/queries";
import { errorResponse } from "@/lib/api";

// One page of the current game's standings (players only).
// ?offset=N — first row to return; page size is fixed server-side.
// ?week=N  — the game week whose picks the rows show, so a lazily-loaded page
//            matches the week the board is on. Defaults to the week in play.
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const raw = Number(params.get("offset"));
    const offset = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    const week = Number(params.get("week"));
    const page = await getStandingsPage(
      user.id,
      offset,
      STANDINGS_PAGE_SIZE,
      Number.isInteger(week) && week > 0 ? week : undefined
    );
    return NextResponse.json(page);
  } catch (err) {
    return errorResponse(err);
  }
}
