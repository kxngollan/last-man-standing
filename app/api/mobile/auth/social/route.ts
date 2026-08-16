import { verifySocialToken } from "@/lib/mobile/socialToken";
import { signInWithOAuth, rememberAppleRefreshToken } from "@/lib/oauth";
import { exchangeAppleCode } from "@/lib/apple/exchangeCode";
import { issueMobileToken } from "@/lib/mobile/auth";
import { json, body, OPTIONS } from "@/lib/mobile/api";
import { isOldEnough, needsParentalConsent, MIN_AGE, PARENTAL_CONSENT_AGE } from "@/lib/age";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export { OPTIONS };

interface Payload {
  provider?: unknown;
  idToken?: unknown;
  /** Only on the second call, once the player has agreed to register. */
  dob?: unknown;
  /** With it, from anyone under PARENTAL_CONSENT_AGE. */
  parentalConsent?: unknown;
  /** Apple hands the name to the device once, at first consent. */
  firstName?: unknown;
  lastName?: unknown;
  /**
   * Apple only. Nothing in the sign-in needs it — it is spent afterwards on the
   * refresh token that deleting the account revokes with.
   */
  authorizationCode?: unknown;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Signing in with Google or Apple from the app.
 *
 * The phone does the provider dance natively and posts the resulting ID token
 * here; we verify it against the provider's keys (lib/mobile/socialToken.ts)
 * and then go through exactly the same account rules the web uses — the shared
 * signInWithOAuth() — so linking, the admin allowlist and the age gate behave
 * identically on both platforms.
 *
 * Registering still isn't automatic. An address we don't know comes back as a
 * 409 asking the app to confirm; the app shows that screen and posts again with
 * a date of birth. The consent and the proof of the address arrive together in
 * that second request, which is tidier than the web's cookie — there is no
 * window in which a consent exists on its own.
 */
export async function POST(request: Request) {
  const payload = await body<Payload>(request);
  if (!payload) return json({ error: "Invalid request." }, { status: 400 });

  const provider = str(payload.provider);
  const idToken = str(payload.idToken);
  if ((provider !== "google" && provider !== "apple") || !idToken) {
    return json({ error: "Invalid request." }, { status: 400 });
  }

  // Verification is a signature check plus a possible key fetch — metered per
  // IP so it can't be used as a grinder.
  if (!(await rateLimit(`mobile-social:${clientIp(request)}`, 30, 15 * 60 * 1000))) {
    return json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const verified = await verifySocialToken(provider, idToken, {
    firstName: str(payload.firstName),
    lastName: str(payload.lastName),
  });
  if (!verified.ok) {
    if (verified.reason === "not-configured") {
      console.error(`[mobile] ${provider} sign-in attempted with no client IDs configured`);
      return json({ error: "That sign-in method isn’t available." }, { status: 501 });
    }
    if (verified.reason === "no-email") {
      return json({ error: "We need an email address from that account." }, { status: 400 });
    }
    return json({ error: "That sign-in couldn’t be verified. Please try again." }, { status: 401 });
  }

  const identity = verified.identity;
  const email = (identity.email ?? "").trim().toLowerCase();

  // A date of birth in the body is the player having said yes on the confirm
  // screen. Checked here as well as there, and again inside signInWithOAuth.
  const dob = str(payload.dob);
  const parentalConsent = payload.parentalConsent === true;
  if (dob) {
    const parsed = new Date(dob);
    if (Number.isNaN(parsed.getTime())) {
      return json({ error: "Enter a valid date of birth." }, { status: 400 });
    }
    if (!isOldEnough(parsed)) {
      return json({ error: `You must be ${MIN_AGE} or older to play.` }, { status: 400 });
    }
    if (needsParentalConsent(parsed) && !parentalConsent) {
      return json(
        { error: `Under ${PARENTAL_CONSENT_AGE}s need a parent or guardian’s permission to play.` },
        { status: 400 }
      );
    }
  }

  const result = await signInWithOAuth(identity, {
    // No referral cookie on a phone — nothing to read it from.
    consent: dob ? { provider, email, dob, parentalConsent } : null,
  });

  if (!result.ok) {
    switch (result.reason) {
      case "no-account":
        // Not an error so much as a question. The app shows the confirmation
        // screen and posts again with a date of birth.
        return json(
          {
            error: "No account for that address yet.",
            needsConsent: true,
            provider,
            email,
          },
          { status: 409 }
        );
      case "too-young":
        return json({ error: `You must be ${MIN_AGE} or older to play.` }, { status: 400 });
      case "needs-parental-consent":
        return json(
          { error: `Under ${PARENTAL_CONSENT_AGE}s need a parent or guardian’s permission to play.` },
          { status: 400 }
        );
      case "unverified-email":
        return json(
          { error: "That account’s email address hasn’t been verified with the provider." },
          { status: 403 }
        );
      default:
        return json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  }

  // Signed in. Now, and only now, spend the authorization code: it works once,
  // and the attempt that came back asking for a date of birth had no account to
  // attach the result to. Failing here costs a revocation at deletion time, so
  // it must not fail the sign-in that has already succeeded.
  const authorizationCode = str(payload.authorizationCode);
  if (provider === "apple" && authorizationCode && identity.clientId) {
    const refreshToken = await exchangeAppleCode(identity.clientId, authorizationCode);
    if (refreshToken) {
      await rememberAppleRefreshToken(result.user.id, { ...identity, refreshToken });
    }
  }

  const { token, expiresAt } = await issueMobileToken(result.user);
  return json({ token, expiresAt, user: result.user, created: result.created });
}
