import type { Metadata } from "next";
import SessionWrapper from "@/components/SessionWrapper";

// No app bar: this step comes before the portal opens. The SessionProvider is
// still needed — the form calls `update()` so the new claims land immediately
// instead of a few minutes later.
export const metadata: Metadata = {
  title: "One more thing",
  robots: { index: false, follow: false },
};

export default function WelcomeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SessionWrapper>{children}</SessionWrapper>;
}
