import { notFound } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import ResetForm from "@/components/auth/ResetForm";
import { PASSWORD_RESET_ENABLED } from "@/lib/features";
import styles from "@/components/auth/authContent.module.css";

export const metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  if (!PASSWORD_RESET_ENABLED) notFound();

  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return (
      <AuthShell>
        <div className={styles.success} role="status">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="var(--color-out-wash)" />
            <path
              d="M12 7v6m0 3.5h.01"
              stroke="var(--color-out-ink)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <h1 className={styles.title}>Invalid reset link</h1>
          <p className={styles.lede}>
            This link is missing its token. Request a new password reset to try again.
          </p>
          <Link href="/forgot" className="lms-btn lms-btn--primary lms-btn--block">
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ResetForm token={token} />
    </AuthShell>
  );
}
