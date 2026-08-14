"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import AuthShell from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import PasswordInput from "@/components/ui/PasswordInput";
import { PASSWORD_RESET_ENABLED } from "@/lib/features";
import isEmail from "@/lib/isEmail";
import { safeNext } from "@/lib/safeNext";
import styles from "@/components/auth/authContent.module.css";

/**
 * A Google/Apple sign-in that was refused comes back here with ?error= — see
 * the signIn callback in auth.ts. Anything unrecognised is Auth.js's own
 * (`Configuration`, `AccessDenied`, …), which we don't explain to the visitor.
 */
function oauthError(code: string | null): string {
  switch (code) {
    case "unverified-email":
      return "That account's email address hasn't been verified with the provider, so we can't use it to log you in. Log in with your password instead.";
    case "malformed":
      return "We didn't get an email address back from that provider, and we need one. Log in with your password instead.";
    case "too-young":
      return "You must be 13 or older to play, so we haven't created an account.";
    case "needs-parental-consent":
      return "Under 16s need a parent or guardian's permission to play, so we haven't created an account. Start again and confirm you have it.";
    case null:
      return "";
    default:
      return "We couldn't complete that sign-in. Please try again, or log in with your password.";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Read once: it belongs to the sign-in they just came back from, not to
  // whatever they do next on this page.
  const [providerError, setProviderError] = useState(() => oauthError(searchParams.get("error")));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setProviderError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!isEmail(email)) {
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
    // Deep links land where they were headed (the proxy sets ?next=).
    router.push(safeNext(searchParams.get("next")));
    router.refresh();
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.lede}>Log in to make your pick before the deadline.</p>

      {providerError && (
        <p className="lms-field__help" data-error="true" role="alert">
          {providerError}
        </p>
      )}

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

      <OAuthButtons next={safeNext(searchParams.get("next"))} />

      {error && (
        <p className={styles.alt}>
          Haven&rsquo;t confirmed your email yet?{" "}
          <Link href="/resend">Resend the confirmation link</Link>
        </p>
      )}

      <p className={styles.alt}>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </AuthShell>
  );
}

// useSearchParams needs a Suspense boundary so the rest of the route can
// still be statically rendered.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
