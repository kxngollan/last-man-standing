import { createHash, randomBytes } from "crypto";
import { connectDB } from "@/database/connect";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/password";
import { isAdminEmail } from "@/lib/adminEmails";

const TTL_MS = 60 * 60 * 1000; // 1h

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
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
  // Receiving the reset email proves ownership, so confirm the address too —
  // and inbox ownership is the bar for the admin allowlist.
  user.emailVerified = true;
  if (isAdminEmail(user.email)) user.isAdmin = true;
  await user.save();

  // Invalidate any other outstanding reset tokens for this user.
  await PasswordResetToken.deleteMany({ userId: record.userId });
  return "ok";
}
