import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { joinGame } from "@/lib/game/join";
import { errorResponse } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireUser();
    await joinGame(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
