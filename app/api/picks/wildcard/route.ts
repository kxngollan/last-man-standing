import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { useWildcard, undoWildcard } from "@/lib/game/pick";
import { errorResponse } from "@/lib/api";

/** Play the wildcard on this week's pick (draw becomes enough to go through). */
export async function POST() {
  try {
    const user = await requireUser();
    await useWildcard(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Take the wildcard back, any time before the week locks. */
export async function DELETE() {
  try {
    const user = await requireUser();
    await undoWildcard(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
