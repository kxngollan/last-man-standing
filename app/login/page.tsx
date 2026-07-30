"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/authContent.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("That doesn’t look like a valid email address.");
      return;
    }
    setSubmitting(true);
    // Simulated call to the credentials provider.
    setTimeout(() => {
      setSubmitting(false);
      setError("We couldn’t find an account with those details. Check and try again.");
    }, 700);
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.lede}>Log in to make your pick before the deadline.</p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={`lms-field ${error ? "lms-field--error" : ""}`}>
          <label className="lms-field__label" htmlFor="email">
            Email
          </label>
          <input
            className="lms-field__control"
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            aria-describedby="login-help"
          />
        </div>

        <div className="lms-field">
          <label className="lms-field__label" htmlFor="password">
            Password
          </label>
          <input
            className="lms-field__control"
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            aria-describedby="login-help"
          />
          <Link href="/login" className={styles.forgot}>
            Forgot password?
          </Link>
        </div>

        <p className="lms-field__help" id="login-help" data-error={!!error} role={error ? "alert" : undefined}>
          {error}
        </p>

        <button
          type="submit"
          className="lms-btn lms-btn--primary lms-btn--block"
          disabled={submitting}
          aria-disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="lms-spinner" aria-hidden="true" />
              Logging in&hellip;
            </>
          ) : (
            "Log in"
          )}
        </button>
      </form>

      <p className={styles.alt}>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </AuthShell>
  );
}
