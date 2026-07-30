import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { useWildcard } from "@/lib/game/pick";
import { errorResponse } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireUser();
    await useWildcard(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
