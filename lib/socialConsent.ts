import { encode, decode } from "@auth/core/jwt";
import type { OAuthProvider } from "@/models/User/User";
import { SITE_URL } from "@/lib/site";

/**
 * "Yes, create me an account" — carried from the confirmation screen back to
 * the OAuth callback.
 *
 * It is deliberately not enough on its own. The consent names an address and a
 * date of birth; the account is only created when the provider hands us that
 * same address, verified, in the same sign-in. So a stolen or forged consent
 * buys nothing without also being able to sign in as that identity.
 *
 * Signed with AUTH_SECRET and short-lived, because it crosses the browser.
 */

export const CONSENT_COOKIE = "lms_social_consent";
export const CONSENT_TTL_S = 10 * 60;

export interface SocialConsent {
  provider: OAuthProvider;
  /** Lowercased. Must match the address the provider returns. */
  email: string;
  /** ISO yyyy-mm-dd, as the date input gives it. */
  dob: string;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

export async function sealConsent(consent: SocialConsent): Promise<string> {
  return encode({
    secret: secret(),
    salt: CONSENT_COOKIE,
    maxAge: CONSENT_TTL_S,
    token: { ...consent },
  });
}

export async function openConsent(raw: string | null | undefined): Promise<SocialConsent | null> {
  if (!raw) return null;
  try {
    const claims = await decode<Record<string, unknown>>({
      secret: secret(),
      salt: CONSENT_COOKIE,
      token: raw,
    });
    const provider = claims?.provider;
    const email = claims?.email;
    const dob = claims?.dob;
    if ((provider !== "google" && provider !== "apple") || typeof email !== "string") return null;
    if (typeof dob !== "string") return null;
    return { provider, email, dob };
  } catch {
    return null; // expired, tampered with, or signed under a different secret
  }
}

/**
 * Apple posts its callback cross-site, and a Lax cookie wouldn't ride along
 * with it — so on https this has to be SameSite=None. That widens where the
 * cookie is sent, which is only acceptable because, as above, the consent
 * cannot create anything by itself.
 */
export function consentCookieOptions() {
  // NODE_ENV is in the test as well as APP_URL: a production deploy that forgot
  // to set APP_URL would otherwise fall back to the localhost default, drop to
  // a Lax cookie, and lose every Apple sign-up to a silently missing consent.
  const secure = SITE_URL.startsWith("https://") || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    path: "/",
    maxAge: CONSENT_TTL_S,
  };
}
