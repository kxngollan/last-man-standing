import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rateLimit";
import isEmail from "@/lib/isEmail";

/**
 * Checking an email and password, in one place.
 *
 * Both front doors go through here — the web's Credentials provider (auth.ts)
 * and the mobile login endpoint. That matters: a second door with its own copy
 * of this logic is a second door someone forgets to put the rate limits on,
 * and it would be an unthrottled password-guessing oracle against the same
 * accounts.
 */

// Compared against when no account matches the email, so a login attempt costs
// the same ~bcrypt time whether or not the account exists — response timing
// can't be used to enumerate accounts. (Hash of a random throwaway.)
const DUMMY_HASH = "$2b$12$NL4fYDmM6QhQOQu0x7.cXuJfdNFmlEqaRDKWho6zGcmL79ENZMsR6";

export interface LoginUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  /**
   * No date of birth on file, so the age gate hasn't been applied to this
   * account — it must finish at /welcome before it can play.
   *
   * Only ever true for an account created by a Google/Apple sign-in. It can
   * still arrive through this password login: an account like that can give
   * itself a password through the reset flow before it has been near /welcome.
   */
  needsOnboarding: boolean;
}

export type LoginResult =
  | { ok: true; user: LoginUser }
  | { ok: false; reason: "malformed" | "rate-limited" | "bad-credentials" | "unverified" | "error" };

/**
 * `ip` feeds the per-IP limit; pass what clientIp() gave you. The per-email
 * limit is stricter, so one victim can't be ground down from many addresses.
 */
export async function attemptLogin(
  rawEmail: unknown,
  rawPassword: unknown,
  ip: string
): Promise<LoginResult> {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!isEmail(email) || password.length < 1) return { ok: false, reason: "malformed" };

  try {
    await connectDB();

    const [ipOk, emailOk] = await Promise.all([
      rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000),
      rateLimit(`login:email:${email}`, 5, 15 * 60 * 1000),
    ]);
    if (!ipOk || !emailOk) return { ok: false, reason: "rate-limited" };

    const user = await User.findOne({ email });

    // Always burn a bcrypt compare so "no such account" and "wrong password"
    // take the same time.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) return { ok: false, reason: "bad-credentials" };
    if (!user.emailVerified) return { ok: false, reason: "unverified" };

    return {
      ok: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        needsOnboarding: !user.dob,
      },
    };
  } catch (err) {
    console.error("[auth] login failed:", (err as Error).message);
    return { ok: false, reason: "error" };
  }
}
