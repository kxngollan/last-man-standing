import type { Metadata } from "next";
import ResendVerificationForm from "@/components/auth/ResendVerificationForm";

export const metadata: Metadata = {
  title: "Resend confirmation email",
  robots: { index: false, follow: false },
};

export default function ResendPage() {
  return <ResendVerificationForm />;
}
