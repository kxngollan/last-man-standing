import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Last Man Standing",
  description: "Compete to find out who has superior football knowledge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
