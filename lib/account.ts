import mongoose from "mongoose";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { hashPassword, verifyPassword } from "@/lib/password";
import { fullName, nameParts } from "@/lib/displayName";
import { isOldEnough } from "@/lib/age";

// Changes a player can make to their own account. Kept out of the route
// handlers so the rules are testable without a session.

export type PasswordChangeResult = "ok" | "wrong-password" | "unknown-user" | "no-password";

/**
 * Set a new password, having checked the current one.
 *
 * Stamping `passwordChangedAt` is what ends other sessions: the jwt callback
 * refuses any token last refreshed before this moment. The caller's own session
 * dies with them, so whoever calls this has to sign in again straight after —
 * the client does that with the new password it already holds.
 */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<PasswordChangeResult> {
  if (!mongoose.isValidObjectId(userId)) return "unknown-user";
  await connectDB();

  const user = await User.findById(userId);
  if (!user) return "unknown-user";

  // Signed up with Google or Apple and never set a password: there's no current
  // password to prove, so this isn't the route in. The reset flow is — it
  // proves the same inbox the provider vouched for.
  if (!user.passwordHash) return "no-password";

  if (!(await verifyPassword(currentPassword, user.passwordHash))) return "wrong-password";

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  return "ok";
}

/**
 * Rename a player. `name` is kept in sync with the split fields because the
 * session and older accounts read it — same rule as the admin rename.
 *
 * There is one name per account, so this also changes how they appear in games
 * already finished.
 */
export async function renameUser(
  userId: string,
  firstName: string,
  lastName: string
): Promise<{ firstName: string; lastName: string; name: string } | null> {
  if (!mongoose.isValidObjectId(userId)) return null;
  await connectDB();

  const user = await User.findById(userId);
  if (!user) return null;

  user.firstName = firstName.trim();
  user.lastName = lastName.trim();
  user.name = fullName(user);
  await user.save();

  const { first, last } = nameParts(user);
  return { firstName: first, lastName: last, name: user.name };
}

export type DateOfBirthResult = "ok" | "unknown-user" | "already-set" | "too-young";

/**
 * Record the date of birth an account signed up without — which only happens
 * through Google or Apple, since neither provider hands one over.
 *
 * Set once. An age is something you state on the way in, not a dial you turn
 * afterwards: allowing edits would let an account that failed the 16+ gate try
 * again with a better answer.
 */
export async function setDateOfBirth(userId: string, dob: Date): Promise<DateOfBirthResult> {
  if (!mongoose.isValidObjectId(userId)) return "unknown-user";
  if (!isOldEnough(dob)) return "too-young";

  await connectDB();
  const user = await User.findById(userId);
  if (!user) return "unknown-user";
  if (user.dob) return "already-set";

  user.dob = dob;
  await user.save();
  return "ok";
}

/**
 * Whether a session predates the account's last password change — the test the
 * jwt callback applies to every refresh. Sessions that fail it are ended.
 *
 * Deliberately applied to client-triggered `update()` calls too: any session can
 * ask for one, so exempting them would let a revoked session renew itself.
 */
export function sessionOutlivedPassword(
  refreshedAt: number,
  passwordChangedAt: Date | null | undefined
): boolean {
  if (!passwordChangedAt) return false;
  return refreshedAt < new Date(passwordChangedAt).getTime();
}
