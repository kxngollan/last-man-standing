import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/password";
import isEmail from "@/lib/isEmail";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Auth.js reports every failure to the client as a generic
        // "CredentialsSignin". We log the real reason here so it's visible
        // in the dev server console. Read fields directly — Auth.js may pass
        // extra keys (callbackUrl, redirect), so a strict schema would reject.
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!isEmail(email) || password.length < 1) {
          console.warn("[auth] login rejected: missing or malformed email/password");
          return null;
        }

        try {
          await connectDB();
        } catch (err) {
          console.error("[auth] login failed: database unreachable —", (err as Error).message);
          return null;
        }

        const user = await User.findOne({ email });
        if (!user) {
          console.warn(`[auth] login rejected: no account for ${email}`);
          return null;
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          console.warn(`[auth] login rejected: wrong password for ${email}`);
          return null;
        }

        if (!user.emailVerified) {
          console.warn(
            `[auth] login rejected: ${email} hasn't confirmed their email (check the signup verification link)`
          );
          return null;
        }

        console.log(`[auth] login ok: ${email}`);
        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
});
