import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { changeOwnPassword } from "@/lib/account";
import { changePasswordSchema } from "@/lib/validation";
import { sendPasswordChangedEmail } from "@/lib/email";
import { readJson, errorResponse } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";

/**
 * Change your own password, having proved you know the current one.
 *
 * Stamping `passwordChangedAt` ends every session issued before now — see the
 * jwt callback in auth.ts. That includes the caller's own session, so the
 * client signs in again with the new password immediately afterwards; it holds
 * the password already, and re-authenticating is the only honest way back in.
 */
export async function POST(request: Request) {
  try {
    const me = await requireUser();

    // Per account, because the current-password field is a guessing surface,
    // and per IP so one attacker can't work through several accounts.
    const userOk = await rateLimit(`pwchange:user:${me.id}`, 5, 15 * 60 * 1000);
    const ipOk = await rateLimit(`pwchange:ip:${clientIp(request)}`, 20, 15 * 60 * 1000);
    if (!userOk || !ipOk) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const parsed = changePasswordSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 }
      );
    }

    const result = await changeOwnPassword(
      me.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    if (result === "unknown-user") {
      return NextResponse.json({ error: "Unknown account." }, { status: 404 });
    }
    if (result === "wrong-password") {
      return NextResponse.json({ error: "That isn’t your current password." }, { status: 400 });
    }
    if (result === "no-password") {
      return NextResponse.json(
        {
          error:
            "This account signs in with Google or Apple and has no password yet. Set one through “Forgot password”.",
        },
        { status: 400 }
      );
    }

    // The password is already changed — a mail outage mustn't undo that or
    // report failure. Losing the notification is the lesser problem.
    if (me.email) {
      try {
        await sendPasswordChangedEmail(me.email, `${SITE_URL}/forgot`);
      } catch (err) {
        console.error("[account] password-changed email failed:", (err as Error).message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
