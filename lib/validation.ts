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
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;

/** Admin edits to a player: rename and/or set verification. */
export const adminUserUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name can’t be empty.").max(40).optional(),
    lastName: z.string().trim().min(1, "Last name can’t be empty.").max(40).optional(),
    emailVerified: z.boolean().optional(),
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
    category: z.enum(["bug", "scores", "account", "other"]),
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
