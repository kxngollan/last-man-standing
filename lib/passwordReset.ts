import { createHash, randomBytes } from "crypto";
import { connectDB } from "@/database/connect";
import { PasswordResetToken } from "@/models/User/PasswordResetToken";
import { User } from "@/models/User/User";
import { hashPassword } from "@/lib/password";
import { isAdminEmail } from "@/lib/adminEmails";
import { sendPasswordResetEmail } from "@/lib/email";
import { PASSWORD_RESET_ENABLED } from "@/lib/features";
import { rateLimit } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";
import isEmail from "@/lib/isEmail";

const TTL_MS = 60 * 60 * 1000; // 1h

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type ResetRequestResult =
  | { ok: true }
  | {
      ok: false;
      reason: "disabled" | "malformed" | "rate-limited" | "no-account" | "send-failed";
    };

/**
 * "Send me a reset link", in one place.
 *
 * Both front doors go through here — the website's /forgot form and the app's
 * mobile endpoint — for the same reason attemptLogin() is shared: a second copy
 * is a second place to forget the rate limits, and this one guards an outbound
 * mailer, so a missed limit is a mail-bomb rather than just a guessing oracle.
 *
 * The emailed link always points at the website's /reset page. There's no
 * native reset screen to send a phone to, and the token is single-use, so one
 * destination is also one place for it to be spent.
 *
 * Each caller keeps its own wording and status codes; this only decides what
 * happened. `ip` feeds the per-IP limit — pass what clientIp() gave you.
 */
export async function requestPasswordReset(
  rawEmail: unknown,
  ip: string
): Promise<ResetRequestResult> {
  if (!PASSWORD_RESET_ENABLED) return { ok: false, reason: "disabled" };

  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!isEmail(email)) return { ok: false, reason: "malformed" };

  // Per IP against enumeration sweeps, and per target address so one victim
  // can't be mail-bombed from many IPs.
  const [ipOk, emailOk] = await Promise.all([
    rateLimit(`forgot:ip:${ip}`, 5, 15 * 60 * 1000),
    rateLimit(`forgot:email:${email}`, 3, 60 * 60 * 1000),
  ]);
  if (!ipOk || !emailOk) return { ok: false, reason: "rate-limited" };

  try {
    await connectDB();
    const user = await User.findOne({ email });
    // Deliberate tradeoff, inherited from the web flow: telling the caller that
    // no account exists makes enumeration possible, and we accept it so nobody
    // sits waiting for an email that was never coming. The limits above are
    // what keep it from being a bulk lookup service.
    if (!user) return { ok: false, reason: "no-account" };

    const token = await createResetToken(String(user._id));
    await sendPasswordResetEmail(email, `${SITE_URL}/reset?token=${token}`);
  } catch (err) {
    console.error("[auth] forgot-password error:", (err as Error).message);
    return { ok: false, reason: "send-failed" };
  }

  return { ok: true };
}

/**
 * Create a single-use password-reset token and return the raw token to email.
 * Rotates: any previously issued reset links for this user stop working, so
 * repeated "forgot password" requests can't accumulate live tokens.
 */
export async function createResetToken(userId: string): Promise<string> {
  await connectDB();
  await PasswordResetToken.deleteMany({ userId });
  const raw = randomBytes(32).toString("hex");
  await PasswordResetToken.create({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return raw;
}

/** Consume a reset token and set a new password. Returns "ok" or "invalid". */
export async function resetPasswordWithToken(
  raw: string,
  newPassword: string
): Promise<"ok" | "invalid"> {
  if (!raw) return "invalid";
  await connectDB();
  const record = await PasswordResetToken.findOne({ tokenHash: hashToken(raw) });
  if (!record) return "invalid";

  await record.deleteOne();
  if (record.expiresAt.getTime() < Date.now()) return "invalid";

  const user = await User.findById(record.userId);
  if (!user) return "invalid";

  user.passwordHash = await hashPassword(newPassword);
  // Someone locked out by an attacker resets here — drop the attacker's session.
  user.passwordChangedAt = new Date();
  // Receiving the reset email proves ownership, so confirm the address too —
  // and inbox ownership is the bar for the admin allowlist.
  user.emailVerified = true;
  if (isAdminEmail(user.email)) user.isAdmin = true;
  await user.save();

  // Invalidate any other outstanding reset tokens for this user.
  await PasswordResetToken.deleteMany({ userId: record.userId });
  return "ok";
}
