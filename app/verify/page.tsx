import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { StatusIcon } from "@/components/ui/StatusIcon";
import VerifyConfirm from "./VerifyConfirm";
import styles from "@/components/auth/authContent.module.css";

export const metadata: Metadata = {
  title: "Confirm email",
  robots: { index: false, follow: false },
};

// The GET never touches the token — consuming happens when the player
// presses the confirm button (see VerifyConfirm), so an email scanner
// prefetching the link can't invalidate it.
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return (
      <AuthShell>
        <div className={styles.success} role="status">
          <StatusIcon kind="error" />
          <h1 className={styles.title}>Link expired or invalid</h1>
          <p className={styles.lede}>
            This confirmation link didn’t work. It may have expired — request a new one and we’ll
            email you a fresh link.
          </p>
          <Link href="/resend" className="lms-btn lms-btn--primary lms-btn--block">
            Request a new link
          </Link>
          <Link href="/login" className="lms-btn lms-btn--ghost lms-btn--block">
            Back to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <VerifyConfirm token={token} />
    </AuthShell>
  );
}
