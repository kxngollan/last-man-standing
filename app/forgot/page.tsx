import { notFound } from "next/navigation";
import ForgotForm from "@/components/auth/ForgotForm";
import { PASSWORD_RESET_ENABLED } from "@/lib/features";

export const metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default function ForgotPage() {
  // Password reset is disabled in production for now.
  if (!PASSWORD_RESET_ENABLED) notFound();
  return <ForgotForm />;
}
