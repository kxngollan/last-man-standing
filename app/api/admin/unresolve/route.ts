import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getUndoableResolution, unresolveMatchday } from "@/lib/game/resolve";
import { errorResponse, readJson } from "@/lib/api";

// Undo the last resolution — the way back from a force-resolve fired by
// mistake. Puts the week back into play and revives everyone it knocked out.
// Body { gameId } is optional: without it, the newest game that has resolved a
// week is used (which is the one the admin panel offers).
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readJson<{ gameId?: string }>(request);
    let gameId = body?.gameId;
    if (!gameId) {
      const undoable = await getUndoableResolution();
      if (!undoable) {
        return NextResponse.json({ error: "There’s no resolved game week to undo." }, { status: 409 });
      }
      gameId = String(undoable.game._id);
    }
    return NextResponse.json(await unresolveMatchday(gameId));
  } catch (err) {
    return errorResponse(err);
  }
}
