"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";
import { PASSWORD_RESET_ENABLED } from "@/lib/features";
import styles from "@/components/auth/authContent.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
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
    const res = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);
    if (res?.error) {
      setError(
        "We couldn’t log you in. Check your details, and if you just signed up, confirm your email first."
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
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
          />
        </div>

        <PasswordInput
          id="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={error || undefined}
        />

        {PASSWORD_RESET_ENABLED && (
          <Link href="/forgot" className={styles.forgot}>
            Forgot password?
          </Link>
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
