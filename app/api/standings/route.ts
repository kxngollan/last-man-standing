import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getStandingsPage, STANDINGS_PAGE_SIZE } from "@/lib/game/queries";
import { errorResponse } from "@/lib/api";

// One page of the current game's standings (players only).
// ?offset=N — first row to return; page size is fixed server-side.
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const raw = Number(new URL(request.url).searchParams.get("offset"));
    const offset = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    const page = await getStandingsPage(user.id, offset, STANDINGS_PAGE_SIZE);
    return NextResponse.json(page);
  } catch (err) {
    return errorResponse(err);
  }
}
