"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusIcon } from "@/components/ui/StatusIcon";
import type { VerifyOutcome } from "@/lib/verification";
import styles from "@/components/auth/authContent.module.css";

type Outcome = VerifyOutcome | "error";

const COPY: Record<Outcome, { title: string; lede: string }> = {
  verified: {
    title: "Email confirmed",
    lede: "Your account is verified. Log in and join the next game when registration opens.",
  },
  already: {
    title: "Already confirmed",
    lede: "This email is already verified. You’re good to log in.",
  },
  invalid: {
    title: "Link expired or invalid",
    lede: "This confirmation link didn’t work. It may have expired — request a new one and we’ll email you a fresh link.",
  },
  error: {
    title: "Couldn’t confirm right now",
    lede: "Something went wrong verifying your email. Please try again shortly.",
  },
};

/**
 * The confirm step: the token is only consumed when the player presses the
 * button (a POST), never by the GET that rendered this page.
 */
export default function VerifyConfirm({ token }: { token: string }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as { outcome?: VerifyOutcome };
      setOutcome(res.ok && data.outcome ? data.outcome : "error");
    } catch {
      setOutcome("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome === null) {
    return (
      <div className={styles.success}>
        <h1 className={styles.title}>Confirm your email</h1>
        <p className={styles.lede}>
          One tap and your place in the game is locked in.
        </p>
        <button
          type="button"
          className="lms-btn lms-btn--primary lms-btn--block"
          onClick={confirm}
          disabled={submitting}
          aria-disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="lms-spinner" aria-hidden="true" />
              Confirming&hellip;
            </>
          ) : (
            "Confirm my email"
          )}
        </button>
      </div>
    );
  }

  const ok = outcome === "verified" || outcome === "already";
  const { title, lede } = COPY[outcome];

  return (
    <div className={styles.success} role="status">
      <StatusIcon kind={ok ? "ok" : "error"} />
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lede}>{lede}</p>
      {outcome === "invalid" && (
        <Link href="/resend" className="lms-btn lms-btn--primary lms-btn--block">
          Request a new link
        </Link>
      )}
      {outcome === "error" && (
        <button
          type="button"
          className="lms-btn lms-btn--primary lms-btn--block"
          onClick={confirm}
        >
          Try again
        </button>
      )}
      <Link
        href="/login"
        className={`lms-btn lms-btn--block ${ok ? "lms-btn--primary" : "lms-btn--ghost"}`}
      >
        {ok ? "Log in" : "Back to log in"}
      </Link>
    </div>
  );
}
