import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/authContent.module.css";
import { consumeVerificationToken, type VerifyOutcome } from "@/lib/verification";

export const metadata = {
  title: "Confirm email",
  robots: { index: false, follow: false },
};

type Outcome = VerifyOutcome | "error";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  let outcome: Outcome = "invalid";
  if (token) {
    try {
      outcome = await consumeVerificationToken(token);
    } catch {
      outcome = "error"; // e.g. DB not reachable
    }
  }

  const ok = outcome === "verified" || outcome === "already";
  const isProduction = process.env.NODE_ENV === "production";

  const copy: Record<Outcome, { title: string; lede: string }> = {
    verified: {
      title: "Email confirmed",
      lede: isProduction
        ? "Your account is verified. You can now log in."
        : "Your account is verified. Log in and join the next game when registration opens.",
    },
    already: {
      title: "Already confirmed",
      lede: isProduction
        ? "This email is already verified. You can now log in."
        : "This email is already verified. You’re good to log in.",
    },
    invalid: {
      title: "Link expired or invalid",
      lede: "This confirmation link didn’t work. It may have expired, so request a new one from the login page.",
    },
    error: {
      title: "Couldn’t confirm right now",
      lede: "Something went wrong verifying your email. Please try the link again shortly.",
    },
  };

  const { title, lede } = copy[outcome];

  return (
    <AuthShell>
      <div className={styles.success} role="status">
        {ok ? (
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
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="var(--color-out-wash)" />
            <path
              d="M12 7v6m0 3.5h.01"
              stroke="var(--color-out-ink)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{lede}</p>
        <Link href="/login" className="lms-btn lms-btn--primary lms-btn--block">
          {ok ? "Log in" : "Back to log in"}
        </Link>
      </div>
    </AuthShell>
  );
}
