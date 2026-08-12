import { encode, decode } from "next-auth/jwt";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { sessionOutlivedPassword } from "@/lib/account";
import { GameError } from "@/lib/game/errors";
import type { SessionUser } from "@/lib/authz";

/**
 * Bearer tokens for the mobile app.
 *
 * The phone has no cookie jar, so the web's session cookie is no use to it.
 * These are the same Auth.js JWTs, encrypted with the same AUTH_SECRET, but
 * salted differently — so a session cookie can't be replayed as a bearer token
 * or the other way round.
 *
 * One 30-day token, no refresh pair: when it expires the app logs in again.
 */

// Distinct from any cookie name Auth.js uses, which is what separates the two
// token families cryptographically.
const SALT = "lms-mobile-bearer";
export const TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, in seconds

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

export interface MobileTokenClaims {
  id: string;
  isAdmin: boolean;
  name?: string | null;
  email?: string | null;
  /** Issued-at, seconds. Compared against passwordChangedAt to revoke. */
  iat?: number;
}

/** Mint a token for a user who has just proved their password. */
export async function issueMobileToken(user: {
  id: string;
  name?: string | null;
  email?: string | null;
  isAdmin: boolean;
}): Promise<{ token: string; expiresAt: string }> {
  const token = await encode({
    token: {
      id: user.id,
      isAdmin: user.isAdmin,
      name: user.name ?? null,
      email: user.email ?? null,
    },
    secret: secret(),
    salt: SALT,
    maxAge: TOKEN_MAX_AGE,
  });
  return {
    token,
    expiresAt: new Date(Date.now() + TOKEN_MAX_AGE * 1000).toISOString(),
  };
}

/** The bearer token on a request, or null if there isn't a well-formed one. */
export function bearerFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
}

/**
 * The user behind a bearer token, or null.
 *
 * Re-runs the same two checks the web's jwt callback does, because a token
 * decoded here never passes through Auth.js: the account must still exist and
 * be verified, and the token must post-date any password change. Without the
 * second, "changing your password signs out other devices" would quietly not
 * apply to phones.
 */
export async function userFromToken(token: string): Promise<SessionUser | null> {
  let claims: MobileTokenClaims | null = null;
  try {
    // decode() enforces the expiry baked in at encode() time.
    claims = await decode<MobileTokenClaims>({ token, secret: secret(), salt: SALT });
  } catch {
    return null; // tampered, wrong salt, or expired
  }
  if (!claims?.id) return null;

  await connectDB();
  const user = await User.findById(claims.id)
    .select("name email isAdmin emailVerified passwordChangedAt")
    .lean();
  if (!user || !user.emailVerified) return null;

  const issuedAtMs = typeof claims.iat === "number" ? claims.iat * 1000 : 0;
  if (sessionOutlivedPassword(issuedAtMs, user.passwordChangedAt)) return null;

  return {
    id: String(user._id),
    isAdmin: user.isAdmin,
    name: user.name,
    email: user.email,
  };
}

/** The signed-in mobile user, or a 401 — the bearer twin of requireUser(). */
export async function requireMobileUser(request: Request): Promise<SessionUser> {
  const token = bearerFrom(request);
  if (!token) throw new GameError("You need to be signed in.", 401);
  const user = await userFromToken(token);
  if (!user) throw new GameError("Your session has expired. Please sign in again.", 401);
  return user;
}
