import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { cookies } from "next/headers";
import { authConfig } from "./auth.config";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { sessionOutlivedPassword } from "@/lib/account";
import { attemptLogin } from "@/lib/login";
import { signInWithOAuth } from "@/lib/oauth";
import { REF_COOKIE } from "@/lib/referral";
import { clientIp } from "@/lib/rateLimit";

// How long a session keeps its claims before re-reading them from the DB.
// Bounds how long a deleted user or demoted admin keeps working access.
const CLAIMS_TTL_MS = 5 * 60 * 1000;

const SOCIAL_PROVIDERS = ["google", "apple"] as const;
type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

function isSocial(provider: string | undefined): provider is SocialProvider {
  return SOCIAL_PROVIDERS.includes(provider as SocialProvider);
}

/**
 * The referral cookie, if they arrived on someone's link before signing in with
 * Google/Apple. Only reachable during the OAuth callback request; missing it
 * costs the referrer their credit, never the player their account.
 *
 * It's a SameSite=Lax cookie (app/r/[handle]), so it rides along with Google's
 * callback — a top-level GET — but not Apple's, which is a cross-site POST.
 * Referrals through Apple sign-ups therefore go uncredited.
 */
async function referralCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(REF_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Credentials logins are already settled by the time this runs, so they
     * pass straight through. A Google/Apple login is decided here: this is
     * where the identity is turned into one of our accounts, or refused.
     */
    async signIn({ user, account, profile }) {
      if (!isSocial(account?.provider)) return true;

      const claims = (profile ?? {}) as Record<string, unknown>;
      const verified = claims.email_verified;
      const result = await signInWithOAuth(
        {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: user.email ?? (typeof claims.email === "string" ? claims.email : null),
          // Google sends a boolean, Apple a boolean or the string "true".
          emailVerified: verified === true || verified === "true",
          firstName: typeof claims.given_name === "string" ? claims.given_name : null,
          lastName: typeof claims.family_name === "string" ? claims.family_name : null,
          name: user.name,
        },
        await referralCookie()
      );

      if (!result.ok) {
        // No email in the log — same reasoning as the credentials provider.
        console.warn(`[auth] ${account.provider} sign-in rejected: ${result.reason}`);
        // A string is a redirect. Ours says what went wrong; the built-in error
        // page would only say "AccessDenied".
        return `/login?error=${result.reason}`;
      }

      // Auth.js hands this same object to the jwt callback below. Overwriting
      // it is what points the session at our user rather than at a provider's
      // subject id.
      user.id = result.user.id;
      user.name = result.user.name;
      user.email = result.user.email;
      Object.assign(user, {
        isAdmin: result.user.isAdmin,
        needsOnboarding: result.user.needsOnboarding,
      });
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        // Fresh login — stamp the claims.
        token.id = (user as { id?: string }).id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
        // Only ever true for an OAuth account that hasn't given us a date of
        // birth yet; a password sign-up collected one on the way in.
        token.needsOnboarding = (user as { needsOnboarding?: boolean }).needsOnboarding ?? false;
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
        .select("isAdmin emailVerified name passwordChangedAt dob")
        .lean();
      if (!dbUser || !dbUser.emailVerified) return null; // gone or unverified → sign out

      // A password change ends every session that predates it. The device that
      // made the change signs in again with the new password on the spot, so it
      // comes back holding a token stamped after this moment.
      if (sessionOutlivedPassword(refreshedAt, dbUser.passwordChangedAt)) return null;

      token.isAdmin = dbUser.isAdmin;
      token.name = dbUser.name;
      // Re-read alongside the rest: /welcome calls `update()` the moment it
      // saves a date of birth, so the gate lifts without waiting out the TTL.
      token.needsOnboarding = !dbUser.dob;
      token.refreshedAt = Date.now();
      return token;
    },
  },
  providers: [
    // Both are OIDC: the account lookup, linking and registration happen in the
    // `signIn` callback above, because there's no database adapter to do it.
    //
    // Registered only when their credentials exist, so /api/auth/providers
    // reports what actually works — that's what the login screen reads to
    // decide which buttons to show, rather than offering a door that opens onto
    // an error page. Apple in particular can't be configured locally: it posts
    // its callback cross-site and refuses http://localhost redirect URIs, so it
    // only works against an HTTPS deployment or a tunnel.
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    ...(process.env.AUTH_APPLE_ID ? [Apple] : []),
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
