import { SignJWT, importPKCS8 } from "jose";
import { connectDB } from "@/database/connect";
import { AppleClientSecret } from "@/models/AppleClientSecret";

/**
 * Apple doesn't issue a client secret. It wants a short-lived ES256 JWT signed
 * with the .p8 key from the developer account, and it stops accepting that JWT
 * once it expires — a secret pasted into the environment is a sign-in outage
 * with a date on it.
 *
 * So the secret lives in the database and this is the only way to get one:
 *
 *   1. a live secret already stored → use it;
 *   2. nothing stored, or what's stored is close to expiring → mint a new one,
 *      save it, use that.
 *
 * The database is what makes step 1 worth anything. Minting per instance would
 * work — Apple accepts any correctly signed JWT — but every serverless cold
 * start would sign a fresh one, and there'd be no single answer to "what is
 * this deployment presenting to Apple right now".
 */

const AUDIENCE = "https://appleid.apple.com";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — Apple's ceiling is ~6 months
const RENEW_WITHIN_SECONDS = 60 * 60 * 24; // treat "under a day left" as expired

/** Saves the round trip on the requests either side of a cold start. */
const cache = new Map<string, { secret: string; expiresAt: number }>();

/**
 * Apple hands you a .p8 file. Whether the environment holds the whole thing,
 * or just the base64 between the header lines, or the whole thing with its
 * newlines escaped, is down to whoever pasted it in — so accept all three and
 * hand `crypto` the PEM it insists on.
 */
function toPem(raw: string): string {
  const key = raw.trim().replace(/\\n/g, "\n");
  if (key.includes("-----BEGIN")) return key;
  const body = key.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

async function mint(clientId: string, now: number, expiresAt: number): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  if (!teamId || !keyId || !privateKey) {
    throw new Error(
      "Cannot mint an Apple client secret: APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY must all be set."
    );
  }

  const key = await importPKCS8(toPem(privateKey), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setAudience(AUDIENCE)
    // Apple checks this against the client_id on the token request.
    .setSubject(clientId)
    .sign(key);
}

/**
 * The stored secret for `clientId`, minting and saving one if there isn't a
 * usable one. Throws if it has to mint and the signing key isn't configured.
 */
export async function getAppleClientSecret(clientId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = new Date((now + RENEW_WITHIN_SECONDS) * 1000);

  const cached = cache.get(clientId);
  if (cached && cached.expiresAt > cutoff.getTime() / 1000) return cached.secret;

  await connectDB();

  const stored = await AppleClientSecret.findOne({ clientId, expiresAt: { $gt: cutoff } })
    .select("secret expiresAt")
    .lean();
  if (stored) {
    const expiresAt = Math.floor(stored.expiresAt.getTime() / 1000);
    cache.set(clientId, { secret: stored.secret, expiresAt });
    return stored.secret;
  }

  const expiresAt = now + TTL_SECONDS;
  const secret = await mint(clientId, now, expiresAt);

  try {
    await AppleClientSecret.updateOne(
      { clientId },
      { $set: { secret, expiresAt: new Date(expiresAt * 1000), createdAt: new Date(now * 1000) } },
      { upsert: true }
    );
  } catch (err) {
    // Two instances renewing at the same moment: one inserts, the other trips
    // the unique index. The other's secret is just as valid — Apple has no
    // opinion about which JWT it sees — so this one goes on using what it
    // signed and leaves the stored copy alone.
    if ((err as { code?: number }).code !== 11000) throw err;
    console.warn("[apple] client secret was renewed concurrently; keeping the one minted here");
  }

  cache.set(clientId, { secret, expiresAt });
  return secret;
}

/** Test seam: drops the in-process cache so the next call re-reads the DB. */
export function resetAppleClientSecretCache(): void {
  cache.clear();
}
