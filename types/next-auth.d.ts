import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      /** Signed in, but the account still owes us a date of birth (see /welcome). */
      needsOnboarding: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isAdmin?: boolean;
    needsOnboarding?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isAdmin?: boolean;
    needsOnboarding?: boolean;
    /** When the claims were last re-read from the database (ms epoch). */
    refreshedAt?: number;
  }
}
