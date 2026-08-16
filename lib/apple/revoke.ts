import { getAppleClientSecret } from "@/lib/apple/clientSecret";
import type { IOAuthAccount } from "@/models/User/User";

/**
 * Telling Apple to forget an account we're deleting.
 *
 * App Review guideline 5.1.1(v) doesn't stop at erasing our own records: an
 * app offering Sign in with Apple has to revoke the tokens it holds when the
 * player deletes their account, so the app stops appearing in their Apple ID
 * settings. Skipping it is a rejection at review, and it leaves someone who
 * asked to be forgotten still listed as a user.
 *
 * The awkward part is which client to present. A refresh token is bound to the
 * client that obtained it, and this app has two — the Services ID for the
 * website, the bundle id for the phone — so the client id is stored alongside
 * the token at sign-in rather than guessed here. That also means the secret
 * this signs with is the right one per client, which getAppleClientSecret()
 * handles: one stored secret per client id.
 *
 * Every failure here is swallowed. Deletion is a promise to the player and a
 * store requirement in its own right; making it contingent on Apple answering
 * would mean an outage at Apple stops people leaving.
 */

const REVOKE_URL = "https://appleid.apple.com/auth/revoke";

/** Apple is a third party on the deletion path — don't wait on it forever. */
const TIMEOUT_MS = 10_000;

export async function revokeAppleAccounts(accounts: IOAuthAccount[] = []): Promise<void> {
  const apple = accounts.filter((a) => a.provider === "apple" && a.refreshToken && a.clientId);

  // The common case by far: a password or Google account, or an Apple account
  // that signed in before the token was recorded.
  if (apple.length === 0) return;

  await Promise.all(apple.map((account) => revokeOne(account)));
}

async function revokeOne(account: IOAuthAccount): Promise<void> {
  const clientId = account.clientId!;
  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: await getAppleClientSecret(clientId),
      token: account.refreshToken!,
      token_type_hint: "refresh_token",
    });

    const response = await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // A revoked token revokes fine a second time — Apple answers 200 to a
    // token it has already forgotten, so a retried deletion is not a problem.
    if (!response.ok) {
      // The body names the reason (invalid_client, invalid_grant); it holds no
      // secret and it is the only way to tell a stale token from a misbuilt
      // request.
      console.error(
        `[apple] revoke failed for ${clientId}: ${response.status} ${await response.text()}`
      );
    }
  } catch (err) {
    console.error(`[apple] revoke failed for ${clientId}: ${(err as Error).message}`);
  }
}
