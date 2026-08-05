import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getCurrentGame } from "@/lib/game/queries";
import { resolveMatchday } from "@/lib/game/resolve";
import { errorResponse, readJson } from "@/lib/api";

// Admin-triggered resolution of the active game's current matchday.
// Body { force: true } resolves a stuck week (e.g. a suspended fixture that
// will never finish): still-incomplete fixtures score their picks as safe.
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readJson<{ force?: boolean }>(request);
    const game = await getCurrentGame();
    if (!game || game.status !== "active") {
      return NextResponse.json({ error: "There isn’t an active game to resolve." }, { status: 409 });
    }
    const result = await resolveMatchday(String(game._id), { force: body?.force === true });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
