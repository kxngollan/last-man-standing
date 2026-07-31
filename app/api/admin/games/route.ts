import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { createGame } from "@/lib/game/admin";
import { readJson, errorResponse } from "@/lib/api";

// Create a new global game in registration.
export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await readJson<{ startMatchday?: number; season?: number }>(request);
    const startMatchday = Number(body?.startMatchday);
    if (!Number.isInteger(startMatchday) || startMatchday < 1 || startMatchday > 38) {
      return NextResponse.json({ error: "Provide a start game week (1 to 38)." }, { status: 400 });
    }
    const season = body?.season ? Number(body.season) : undefined;
    const game = await createGame({ createdBy: user.id, startMatchday, season });
    return NextResponse.json({ ok: true, gameId: String(game._id) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
