import type { Metadata } from "next";

// The login page itself is a Client Component, so its metadata lives here in a
// Server Component layout wrapping it.
export const metadata: Metadata = {
  title: "Log in",
  description:
    "Log in to your Last Man Standing account to make your weekly pick and follow the standings.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
