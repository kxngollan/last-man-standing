import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getCurrentGame } from "@/lib/game/queries";
import { resolveMatchday } from "@/lib/game/resolve";
import { errorResponse } from "@/lib/api";

// Admin-triggered resolution of the active game's current matchday.
export async function POST() {
  try {
    await requireAdmin();
    const game = await getCurrentGame();
    if (!game || game.status !== "active") {
      return NextResponse.json({ error: "There isn’t an active game to resolve." }, { status: 409 });
    }
    const result = await resolveMatchday(String(game._id));
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
