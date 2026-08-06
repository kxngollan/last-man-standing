import type { Metadata } from "next";
import SessionWrapper from "@/components/SessionWrapper";
import AppBar from "@/components/portal/AppBar";

// Private by default — the public pages (table, fixtures) override robots
// and set their own titles in their page metadata.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The SessionProvider lives here (not the root layout) so the static
  // landing/auth pages never pay for a client session fetch.
  return (
    <SessionWrapper>
      <AppBar />
      {children}
    </SessionWrapper>
  );
}
