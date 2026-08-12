import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { sessionOutlivedPassword } from "@/lib/account";
import { attemptLogin } from "@/lib/login";
import { clientIp } from "@/lib/rateLimit";

// How long a session keeps its claims before re-reading them from the DB.
// Bounds how long a deleted user or demoted admin keeps working access.
const CLAIMS_TTL_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        // Fresh login — stamp the claims.
        token.id = (user as { id?: string }).id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
        token.refreshedAt = Date.now();
        return token;
      }

      const refreshedAt = typeof token.refreshedAt === "number" ? token.refreshedAt : 0;
      // `update()` from the client forces an immediate re-read — that's how a
      // rename reaches the app bar without waiting out the TTL. It deliberately
      // does NOT skip the checks below: any session can call it, so treating it
      // as trusted would hand a revoked session a way to renew itself.
      if (trigger !== "update" && Date.now() - refreshedAt < CLAIMS_TTL_MS) return token;

      // Claims are stale — re-read them so deletion/demotion actually bites.
      try {
        await connectDB();
      } catch {
        return token; // DB blip: keep the old claims until the next request
      }
      const dbUser = await User.findById(token.id)
        .select("isAdmin emailVerified name passwordChangedAt")
        .lean();
      if (!dbUser || !dbUser.emailVerified) return null; // gone or unverified → sign out

      // A password change ends every session that predates it. The device that
      // made the change signs in again with the new password on the spot, so it
      // comes back holding a token stamped after this moment.
      if (sessionOutlivedPassword(refreshedAt, dbUser.passwordChangedAt)) return null;

      token.isAdmin = dbUser.isAdmin;
      token.name = dbUser.name;
      token.refreshedAt = Date.now();
      return token;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        // The credential check itself lives in lib/login.ts, shared with the
        // mobile login endpoint. Read fields directly — Auth.js may pass extra
        // keys (callbackUrl, redirect), so a strict schema would reject.
        const result = await attemptLogin(credentials?.email, credentials?.password, clientIp(request));

        // Auth.js reports every failure to the client as a generic
        // "CredentialsSignin". We log the reason (never the email — that's PII
        // and a credential-stuffing oracle in aggregated logs) so it's visible
        // in the dev server console.
        if (!result.ok) {
          console.warn(`[auth] login rejected: ${result.reason}`);
          return null;
        }
        return result.user;
      },
    }),
  ],
});
