import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(40),
    lastName: z.string().trim().min(1, "Enter your last name.").max(40),
    email: z.string().trim().regex(EMAIL_RE, "Enter a valid email address."),
    // bcrypt only reads the first 72 bytes — longer would silently truncate.
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
    dob: z.string().min(1, "Enter your date of birth."), // ISO yyyy-mm-dd from the date input
    /** Only meaningful under PARENTAL_CONSENT_AGE; the server decides when it's required. */
    parentalConsent: z.boolean().optional(),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Agreeing to have an account created after signing in with Google/Apple with
 * an address we've never seen. The email is the one the provider returned; it
 * is checked against the provider's answer again before anything is created.
 */
export const socialConsentSchema = z
  .object({
    provider: z.enum(["google", "apple"]),
    email: z.string().trim().regex(EMAIL_RE, "Enter a valid email address."),
    dob: z.string().min(1, "Enter your date of birth."),
    parentalConsent: z.boolean().optional(),
  })
  .strict();

/**
 * The one thing Google and Apple can't tell us. Asked for at /welcome, once,
 * after a social sign-up — the age gate has nothing to work with until then.
 */
export const completeProfileSchema = z
  .object({
    dob: z.string().min(1, "Enter your date of birth."), // ISO yyyy-mm-dd from the date input
    parentalConsent: z.boolean().optional(),
  })
  .strict();

/** Admin edits to a player: rename and/or set verification. */
export const adminUserUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name can’t be empty.").max(40).optional(),
    lastName: z.string().trim().min(1, "Last name can’t be empty.").max(40).optional(),
    emailVerified: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." });

/** A player renaming themselves from the settings page. */
export const updateNameSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(40),
    lastName: z.string().trim().min(1, "Enter your last name.").max(40),
  })
  .strict();

/**
 * Deleting your own account. The literal word is the whole point: it can't be
 * arrived at by a mistyped request, only by someone who meant it. Both clients
 * make you type it, so this is the server holding the same line.
 */
export const deleteAccountSchema = z
  .object({
    confirm: z.literal("DELETE", { message: "Type DELETE to confirm." }),
  })
  .strict();

/** Changing your own password: prove the current one, then set a new one. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    // Same bounds as signup — bcrypt only reads the first 72 bytes.
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
  })
  .strict()
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Your new password must be different from your current one.",
    path: ["newPassword"],
  });

/** Your referral link, and whether you appear on the public board. */
export const updateReferralSchema = z
  .object({
    // Length and character rules live in lib/referral.ts validateHandle, so
    // there's one definition of a legal handle. This only bounds the payload.
    referralHandle: z.string().trim().max(60).optional(),
    hideFromBoard: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." });

export const loginSchema = z
  .object({
    email: z.string().trim().regex(EMAIL_RE, "Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
  })
  .strict();

/** An issue report: what kind of problem, and what happened. */
export const issueSchema = z
  .object({
    category: z.enum(["bug", "scores", "account", "player", "other"]),
    message: z
      .string()
      .trim()
      .min(1, "Tell us what happened.")
      .max(2000, "Keep it under 2000 characters."),
    page: z.string().trim().max(200).optional(),
  })
  .strict();

/** Player feedback: a required 1–5 rating plus an optional comment. */
export const feedbackSchema = z
  .object({
    rating: z.number().int().min(1, "Pick a rating.").max(5),
    message: z.string().trim().max(1000, "Keep it under 1000 characters.").optional(),
  })
  .strict();

export const pickSchema = z
  .object({
    teamApiId: z.number().int().positive(),
  })
  .strict();

export const createGameSchema = z
  .object({
    season: z.number().int().min(2020).max(2100),
    startMatchday: z.number().int().min(1).max(38),
  })
  .strict();
