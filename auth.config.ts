import type { NextAuthConfig } from "next-auth";

// Shared, dependency-free config. Safe to load anywhere (incl. proxy/route
// protection) because it never touches the database. The Credentials provider
// with DB access is added in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
        token.needsOnboarding = (user as { needsOnboarding?: boolean }).needsOnboarding ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.isAdmin = (token.isAdmin as boolean) ?? false;
        // Read by proxy.ts to hold a social sign-up at /welcome until it has
        // given a date of birth.
        session.user.needsOnboarding = (token.needsOnboarding as boolean) ?? false;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
