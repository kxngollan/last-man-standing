import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(80),
    email: z.string().trim().regex(EMAIL_RE, "Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters.").max(200),
    dob: z.string().min(1, "Enter your date of birth."), // ISO yyyy-mm-dd from the date input
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;

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
