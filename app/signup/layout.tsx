import type { Metadata } from "next";

// Metadata for the Client Component sign-up page lives in this Server Component
// layout. This is a public, indexable landing route.
export const metadata: Metadata = {
  title: "Sign up",
  description:
    "Create a free Last Man Standing account and join the Premier League survival game. Pick one team to win each week and be the last player standing.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
