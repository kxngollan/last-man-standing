"use client";

import { useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/ui/PasswordInput";
import styles from "@/components/auth/authContent.module.css";

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");
    let bad = false;
    if (password.length < 8) {
      setPwError("Use at least 8 characters.");
      bad = true;
    } else setPwError(undefined);
    if (confirm !== password) {
      setConfirmError("Passwords don’t match.");
      bad = true;
    } else setConfirmError(undefined);
    if (bad) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(data.detail ? `${data.error}: ${data.detail}` : data.error ?? "Couldn’t reset your password.");
        return;
      }
      setDone(true);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
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
        <h1 className={styles.title}>Password updated</h1>
        <p className={styles.lede}>You can now log in with your new password.</p>
        <Link href="/login" className="lms-btn lms-btn--primary lms-btn--block">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Set a new password</h1>
      <p className={styles.lede}>Choose a new password for your account.</p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <PasswordInput
          id="password"
          label="New password"
          required
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={pwError}
          helper="At least 8 characters."
        />
        <PasswordInput
          id="confirm"
          label="Confirm new password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          error={confirmError}
        />

        {serverError && (
          <p className="lms-field__help" data-error="true" role="alert">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          className="lms-btn lms-btn--primary lms-btn--block"
          disabled={submitting}
          aria-disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="lms-spinner" aria-hidden="true" />
              Updating&hellip;
            </>
          ) : (
            "Update password"
          )}
        </button>
      </form>

      <p className={styles.alt}>
        <Link href="/login">Back to log in</Link>
      </p>
    </>
  );
}
