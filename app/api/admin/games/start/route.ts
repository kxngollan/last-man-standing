import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin } from "@/lib/authz";
import { startGame } from "@/lib/game/admin";
import { readJson, errorResponse } from "@/lib/api";

// Close registration and kick off game week 1.
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readJson<{ gameId?: string }>(request);
    if (!body?.gameId || !Types.ObjectId.isValid(body.gameId)) {
      return NextResponse.json({ error: "A valid gameId is required." }, { status: 400 });
    }
    await startGame(body.gameId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
