import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { setDateOfBirth } from "@/lib/account";
import { completeProfileSchema } from "@/lib/validation";
import { MIN_AGE } from "@/lib/age";
import { readJson, errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";

/**
 * The date of birth a Google/Apple sign-up couldn't give us, saved from
 * /welcome. Until it lands, `needsOnboarding` is true on the session and
 * proxy.ts keeps the portal shut.
 *
 * It can only be set once — see setDateOfBirth — so this is not a way to walk
 * an account back and forth across the 16+ line.
 */
export async function POST(request: Request) {
  try {
    // The one route that has to work while onboarding is still outstanding.
    const me = await requireUser({ allowPendingOnboarding: true });

    // Set-once, so this is only a floor under retries of a failing date.
    if (!(await rateLimit(`dob:${me.id}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = completeProfileSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 }
      );
    }

    const dob = new Date(parsed.data.dob);
    if (Number.isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
    }

    const result = await setDateOfBirth(me.id, dob);
    if (result === "unknown-user") {
      return NextResponse.json({ error: "Unknown account." }, { status: 404 });
    }
    if (result === "too-young") {
      return NextResponse.json(
        { error: `You must be ${MIN_AGE} or older to play.` },
        { status: 400 }
      );
    }
    if (result === "already-set") {
      return NextResponse.json(
        { error: "Your date of birth is already on file." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
