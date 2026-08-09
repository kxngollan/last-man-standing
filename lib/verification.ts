import { createHash, randomBytes } from "crypto";
import { connectDB } from "@/database/connect";
import { VerificationToken } from "@/models/User/VerificationToken";
import { User } from "@/models/User/User";
import { isAdminEmail } from "@/lib/adminEmails";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Create a verification token for a user and return the raw token to email. */
export async function createVerificationToken(userId: string): Promise<string> {
  await connectDB();
  const raw = randomBytes(32).toString("hex");
  await VerificationToken.create({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return raw;
}

/**
 * Invalidate any outstanding verification tokens for a user and issue a fresh
 * one. Used by the resend flow so only the most recently emailed link works.
 */
export async function rotateVerificationToken(userId: string): Promise<string> {
  await connectDB();
  await VerificationToken.deleteMany({ userId });
  return createVerificationToken(userId);
}

export type VerifyOutcome = "verified" | "already" | "invalid";

/** Consume a verification token, marking the user verified. Single-use. */
export async function consumeVerificationToken(raw: string): Promise<VerifyOutcome> {
  if (!raw) return "invalid";
  await connectDB();
  const record = await VerificationToken.findOne({ tokenHash: hashToken(raw) });
  if (!record) return "invalid";

  await record.deleteOne();
  if (record.expiresAt.getTime() < Date.now()) return "invalid";

  const user = await User.findById(record.userId);
  if (!user) return "invalid";
  if (user.emailVerified) return "already";

  user.emailVerified = true;
  // Verification proves inbox ownership — the safe moment to grant admin.
  if (isAdminEmail(user.email)) user.isAdmin = true;
  await user.save();
  return "verified";
}
