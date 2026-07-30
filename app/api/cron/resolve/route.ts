import { NextResponse } from "next/server";
import { getCurrentGame } from "@/lib/game/queries";
import { resolveMatchday } from "@/lib/game/resolve";
import { errorResponse } from "@/lib/api";

// Scheduled resolution. Call from a cron/scheduler with:
//   Authorization: Bearer <CRON_SECRET>
// Safe to call repeatedly — resolveMatchday only finalizes once a matchday is complete.
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const game = await getCurrentGame();
    if (!game || game.status !== "active") {
      return NextResponse.json({ ok: true, message: "No active game." });
    }
    const result = await resolveMatchday(String(game._id));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
