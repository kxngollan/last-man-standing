import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(40),
    lastName: z.string().trim().min(1, "Enter your last name.").max(40),
    email: z.string().trim().regex(EMAIL_RE, "Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters.").max(200),
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
