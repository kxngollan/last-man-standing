import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { makePick } from "@/lib/game/pick";
import { pickSchema } from "@/lib/validation";
import { readJson, errorResponse } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = pickSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a valid team." }, { status: 400 });
    }
    await makePick(user.id, parsed.data.teamApiId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
