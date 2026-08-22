import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getUndoableResolution } from "@/lib/game/resolve";
import { notifyMatchdayResults } from "@/lib/game/notify";
import { errorResponse, readJson } from "@/lib/api";

// Email every player the verdict on the last resolved game week — through,
// out, won, or all-out. Safe to fire twice: each player is stamped once told,
// so a second run only picks up whoever was added, retried, or failed.
// Body { gameId, matchday } are both optional: without them the newest game
// that has resolved a week, and the week it last resolved, are used.
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readJson<{ gameId?: string; matchday?: number }>(request);
    let gameId = body?.gameId;
    if (!gameId) {
      const undoable = await getUndoableResolution();
      if (!undoable) {
        return NextResponse.json(
          { error: "There’s no resolved game week to email about." },
          { status: 409 }
        );
      }
      gameId = String(undoable.game._id);
    }
    return NextResponse.json(await notifyMatchdayResults(gameId, body?.matchday));
  } catch (err) {
    return errorResponse(err);
  }
}
