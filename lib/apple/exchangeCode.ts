import { getAppleClientSecret } from "@/lib/apple/clientSecret";

/**
 * Turning the app's one-shot authorization code into a refresh token.
 *
 * The website gets a refresh token for free: Auth.js does the code exchange as
 * part of signing in, and hands us the result. A phone doesn't — native Sign in
 * with Apple returns an id token (which is all we need to know who they are)
 * and an authorization code (which is the only way to obtain a token that can
 * later be revoked). Nothing in the sign-in needs the code, so this exists
 * purely so deleting the account can honour guideline 5.1.1(v) — see
 * lib/apple/revoke.ts.
 *
 * The code is single use and expires in about five minutes, which decides when
 * this is called: after the sign-in has actually succeeded, never before. On
 * the sign-up path the first attempt comes back asking for a date of birth, and
 * spending the code on that attempt would leave the account that gets created a
 * moment later with nothing to revoke.
 *
 * Returns null on any failure. It costs a revocation later, never the sign-in
 * happening now.
 */

const TOKEN_URL = "https://appleid.apple.com/auth/token";
const TIMEOUT_MS = 10_000;

export async function exchangeAppleCode(clientId: string, code: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: await getAppleClientSecret(clientId),
      // No redirect_uri: there isn't one. That parameter belongs to the web
      // flow, and sending it with a code minted on a device is rejected.
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[apple] code exchange failed for ${clientId}: ${response.status} ${await response.text()}`
      );
      return null;
    }

    const json = (await response.json()) as { refresh_token?: unknown };
    return typeof json.refresh_token === "string" ? json.refresh_token : null;
  } catch (err) {
    console.error(`[apple] code exchange failed for ${clientId}: ${(err as Error).message}`);
    return null;
  }
}
