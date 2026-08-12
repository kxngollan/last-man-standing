import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * `hash` is optional because an account signed up with Google or Apple has no
 * password until it sets one. Note that the no-hash case returns immediately —
 * callers that must not leak whether an account exists (attemptLogin) compare
 * against a dummy hash instead of passing undefined through here.
 */
export function verifyPassword(plain: string, hash: string | undefined): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
