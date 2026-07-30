import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/authContent.module.css";

export const metadata = {
  title: "Email confirmed — Last Man Standing",
};

// Design view of the post-confirmation screen. The real page will resolve the
// token from the URL and render this confirmed state, or an expired-link variant.
export default function VerifyPage() {
  return (
    <AuthShell>
      <div className={styles.success} role="status">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="var(--color-safe-wash)" />
          <path
            d="m8 12 2.8 2.8L16 9.5"
            stroke="var(--color-safe-ink)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className={styles.title}>Email confirmed</h1>
        <p className={styles.lede}>
          Your account is verified. You&rsquo;re all set to join the next game &mdash; log in and
          make your first pick when registration opens.
        </p>
        <Link href="/login" className="lms-btn lms-btn--primary lms-btn--block">
          Log in
        </Link>
        <p className={styles.alt}>
          Link expired? <Link href="/login">Request a new one</Link>
        </p>
      </div>
    </AuthShell>
  );
}
