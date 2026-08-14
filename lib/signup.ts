import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { VerificationToken } from "@/models/User/VerificationToken";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { isOldEnough, needsParentalConsent, MIN_AGE, PARENTAL_CONSENT_AGE } from "@/lib/age";
import { createVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";
import { clearReferralRecords, ensureReferralHandle, recordReferral } from "@/lib/referral";

/**
 * Creating an account, in one place.
 *
 * Both front doors go through here — the web form and the app's sign-up
 * endpoint — for the same reason attemptLogin() is shared: a second copy of
 * this is a second copy that someone forgets to rate-limit, or that quietly
 * skips the age gate, or that creates an account and never sends the
 * confirmation email.
 *
 * Unexpected failures throw. The callers wrap them so the route's own error
 * shape (and its dev-only detail) is preserved.
 */

export type SignupOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: "rate-limited" }
  | { ok: false; reason: "invalid"; message: string; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: "too-young"; message: string }
  | { ok: false; reason: "needs-parental-consent"; message: string }
  | { ok: false; reason: "taken" };

export interface SignupContext {
  /** From clientIp() — feeds the per-IP limit. */
  ip: string;
  /** The `lms_ref` cookie, if they arrived on someone's link. */
  referralCookie?: string | null;
}

export async function registerAccount(
  body: unknown,
  { ip, referralCookie }: SignupContext
): Promise<SignupOutcome> {
  // Metered before anything else is read. This endpoint hashes a password
  // (CPU) and sends an email, so an invalid body has to cost the same budget
  // as a valid one — otherwise the cheap path is a free grinder.
  if (!(await rateLimit(`signup:${ip}`, 10, 60 * 60 * 1000))) {
    return { ok: false, reason: "rate-limited" };
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsed.error.issues[0]?.message ?? "Please check the form.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { firstName, lastName, email, password, dob, parentalConsent } = parsed.data;
  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) {
    return { ok: false, reason: "invalid", message: "Enter a valid date of birth.", fieldErrors: {} };
  }
  if (!isOldEnough(dobDate)) {
    return { ok: false, reason: "too-young", message: `You must be ${MIN_AGE} or older to sign up.` };
  }
  // The under-16 declaration. Checked here rather than only in the forms, so
  // neither client can create a child's account by leaving the box out of the
  // request.
  const minorConsent = needsParentalConsent(dobDate);
  if (minorConsent && parentalConsent !== true) {
    return {
      ok: false,
      reason: "needs-parental-consent",
      message: `Under ${PARENTAL_CONSENT_AGE}s need a parent or guardian’s permission to play.`,
    };
  }

  await connectDB();
  const emailLc = email.toLowerCase();
  if (await User.findOne({ email: emailLc })) return { ok: false, reason: "taken" };

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await User.create({
      firstName,
      lastName,
      // `name` mirrors the split fields — the auth session and legacy code read it.
      name: `${firstName} ${lastName}`,
      email: emailLc,
      passwordHash,
      dob: dobDate,
      // Only ever true for the band that was actually asked.
      parentalConsent: minorConsent,
      emailVerified: false,
      // Never at signup — ADMIN_EMAILS grants admin at email verification,
      // once inbox ownership is proven (lib/adminEmails.ts).
      isAdmin: false,
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
      return { ok: false, reason: "taken" };
    }
    throw err;
  }

  // Their own link, and credit to whoever sent them. Neither can be allowed
  // to fail a registration that has already succeeded.
  try {
    await ensureReferralHandle(String(user._id));
    await recordReferral(String(user._id), referralCookie);
  } catch (err) {
    console.error("[signup] referral bookkeeping failed:", (err as Error).message);
  }

  // Send the confirmation link. If it can't be sent, roll the account back
  // so the player can simply sign up again — with no resend flow, an
  // unverified account with no email would be permanently locked out.
  try {
    const token = await createVerificationToken(String(user._id));
    await sendVerificationEmail(emailLc, `${SITE_URL}/verify?token=${token}`);
  } catch (err) {
    await VerificationToken.deleteMany({ userId: user._id });
    // The account is going — its handle and referral row go with it, or they
    // outlive the user and the handle stays claimed by nobody.
    await clearReferralRecords(String(user._id));
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  return { ok: true, userId: String(user._id) };
}
