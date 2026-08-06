import type { Metadata } from "next";
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
  // AppBar carries its own SessionProvider — everything that needs session
  // state lives inside it, so pages without it stay session-free.
  return (
    <>
      <AppBar />
      {children}
    </>
  );
}
