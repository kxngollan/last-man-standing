import type { Metadata } from "next";
import AppBar from "@/components/portal/AppBar";
import SessionWrapper from "@/components/SessionWrapper";

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
  // One SessionProvider for the whole portal, covering the app bar and the
  // pages alike: the settings form calls `update()` after a rename, and the bar
  // only sees it because they share this context.
  return (
    <SessionWrapper>
      <AppBar />
      {children}
    </SessionWrapper>
  );
}
