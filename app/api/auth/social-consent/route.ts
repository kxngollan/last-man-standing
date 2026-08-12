import { NextResponse } from "next/server";
import { socialConsentSchema } from "@/lib/validation";
import { isOldEnough, MIN_AGE } from "@/lib/age";
import { sealConsent, consentCookieOptions, CONSENT_COOKIE } from "@/lib/socialConsent";
import { readJson, errorResponse } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import isEmail from "@/lib/isEmail";

/**
 * "Yes, create the account" from the confirmation screen.
 *
 * This writes nothing to the database. All it does is sign a short-lived cookie
 * saying which address the player agreed to register and the date of birth they
 * gave; the account is only created if the provider then hands us that same
 * address, verified, on the sign-in that follows (lib/oauth.ts). So this
 * endpoint being open costs nothing — a consent for an address you can't sign
 * in as is worthless.
 */
export async function POST(request: Request) {
  try {
    if (!(await rateLimit(`social-consent:${clientIp(request)}`, 20, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = socialConsentSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    if (!isEmail(email)) {
      return NextResponse.json({ error: "That isn’t a valid email address." }, { status: 400 });
    }

    const dob = new Date(parsed.data.dob);
    if (Number.isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
    }
    // Said here so they hear it before a round trip to the provider. The check
    // that counts is the one in lib/oauth.ts, at the point of creation.
    if (!isOldEnough(dob)) {
      return NextResponse.json(
        { error: `You must be ${MIN_AGE} or older to play.` },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      CONSENT_COOKIE,
      await sealConsent({ provider: parsed.data.provider, email, dob: parsed.data.dob }),
      consentCookieOptions()
    );
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
