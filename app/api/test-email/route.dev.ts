import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { readJson, errorResponse } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";

type Kind = "verification" | "reset";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user.email) throw new GameError("Your account has no email address.", 400);

    const body = await readJson<{ kind?: Kind }>(request);
    const kind = body?.kind;
    if (kind !== "verification" && kind !== "reset") {
      throw new GameError('Pick an email type: "verification" or "reset".', 400);
    }

    // Test emails only ever go to the signed-in user's own address.
    const origin = new URL(request.url).origin;
    if (kind === "verification") {
      await sendVerificationEmail(user.email, `${origin}/verify?token=test-email`);
    } else {
      await sendPasswordResetEmail(user.email, `${origin}/reset?token=test-email`);
    }

    // Without SMTP_HOST the senders fall back to logging the link server-side.
    const delivered = !!process.env.SMTP_HOST;
    return NextResponse.json({ ok: true, delivered, to: user.email });
  } catch (err) {
    return errorResponse(err);
  }
}
