import jwt from 'jsonwebtoken';

const AUDIENCE = 'https://appleid.apple.com';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — Apple's max is ~6 months
const REFRESH_BEFORE = 60 * 60 * 24;   // remint when under a day left

const privateKey = process.env.APPLE_PRIVATE_KEY

const cache = new Map<string, { secret: string; expiresAt: number }>();

export function getAppleClientSecret(clientId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const cached = cache.get(clientId);

  if (cached && cached.expiresAt - now > REFRESH_BEFORE) {
    return cached.secret;
  }

  const expiresAt = now + TTL_SECONDS;

  const secret = jwt.sign(
    {
      iss: process.env.APPLE_TEAM_ID,
      iat: now,
      exp: expiresAt,
      aud: AUDIENCE,
      sub: clientId,
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: process.env.APPLE_KEY_ID,
    },
  );

  cache.set(clientId, { secret, expiresAt });
  return secret;
}