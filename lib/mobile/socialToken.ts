import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { OAuthIdentity } from "@/lib/oauth";
import type { OAuthProvider } from "@/models/User/User";

/**
 * Checking the ID token a phone got from Google or Apple.
 *
 * The web never does this: there, Auth.js completes the OAuth exchange itself
 * and hands us a profile it has already validated. A native app does the dance
 * on the device and can only give us the resulting token — so the token is all
 * the proof there is, and it gets checked here properly: signature against the
 * provider's published keys, issuer, audience, and expiry.
 *
 * The audience check is the one that matters most. Without it, an ID token
 * minted for *any other app* on the same provider would be accepted, and
 * anyone with an unrelated Google app could sign in as any of our players. So
 * the token has to name one of our client IDs.
 */

interface ProviderSpec {
  jwksUrl: string;
  issuers: string[];
  /** Client IDs we accept in `aud` — one per platform. */
  audiences: () => string[];
}

function list(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const SPECS: Record<OAuthProvider, ProviderSpec> = {
  google: {
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    // Google still issues both spellings.
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    // Native sign-in mints a token for the platform's own client ID, not the
    // web one, so each platform's ID has to be listed.
    audiences: () => [...list(process.env.MOBILE_GOOGLE_CLIENT_IDS), ...list(process.env.AUTH_GOOGLE_ID)],
  },
  apple: {
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
    // Native Sign in with Apple puts the app's bundle ID in `aud` — the
    // Services ID is only used by the web flow.
    audiences: () => [...list(process.env.MOBILE_APPLE_CLIENT_IDS), ...list(process.env.AUTH_APPLE_ID)],
  },
};

// Cached across requests: each holds the provider's keys and re-fetches them
// only when they rotate. Rebuilding per request would mean a network round trip
// on every sign-in.
const jwks = new Map<OAuthProvider, ReturnType<typeof createRemoteJWKSet>>();

function keysFor(provider: OAuthProvider) {
  let set = jwks.get(provider);
  if (!set) {
    set = createRemoteJWKSet(new URL(SPECS[provider].jwksUrl));
    jwks.set(provider, set);
  }
  return set;
}

export type SocialTokenResult =
  | { ok: true; identity: OAuthIdentity }
  | { ok: false; reason: "not-configured" | "invalid-token" | "no-email" };

/**
 * The claims of a verified token, turned into the same identity shape the web
 * builds from an Auth.js profile — so both doors end up in signInWithOAuth()
 * with identical material and the account rules can't drift apart.
 */
export function identityFromClaims(
  provider: OAuthProvider,
  claims: JWTPayload & Record<string, unknown>,
  fallbackName?: { firstName?: string | null; lastName?: string | null }
): OAuthIdentity | null {
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!email) return null;

  const verified = claims.email_verified;
  return {
    provider,
    providerAccountId: String(claims.sub ?? ""),
    email,
    // Google sends a boolean, Apple a boolean or the string "true".
    emailVerified: verified === true || verified === "true",
    // Google puts the name in the token. Apple never does — it hands the name
    // to the device once, at first consent, so the app passes it up separately.
    firstName:
      (typeof claims.given_name === "string" ? claims.given_name : null) ??
      fallbackName?.firstName ??
      null,
    lastName:
      (typeof claims.family_name === "string" ? claims.family_name : null) ??
      fallbackName?.lastName ??
      null,
    name: typeof claims.name === "string" ? claims.name : null,
  };
}

export async function verifySocialToken(
  provider: OAuthProvider,
  idToken: string,
  fallbackName?: { firstName?: string | null; lastName?: string | null }
): Promise<SocialTokenResult> {
  const spec = SPECS[provider];
  const audiences = spec.audiences();
  // Nothing to check the token against — refuse rather than skip the check.
  if (audiences.length === 0) return { ok: false, reason: "not-configured" };

  let claims: JWTPayload;
  try {
    const verified = await jwtVerify(idToken, keysFor(provider), {
      issuer: spec.issuers,
      audience: audiences,
      // Small allowance for phone clocks that drift.
      clockTolerance: 60,
    });
    claims = verified.payload;
  } catch (err) {
    console.warn(`[mobile] ${provider} id_token rejected: ${(err as Error).message}`);
    return { ok: false, reason: "invalid-token" };
  }

  const identity = identityFromClaims(provider, claims as JWTPayload & Record<string, unknown>, fallbackName);
  if (!identity || !identity.providerAccountId) return { ok: false, reason: "no-email" };
  return { ok: true, identity };
}
