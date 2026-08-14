"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import AuthShell from "@/components/auth/AuthShell";
import { ageFromDob, MIN_AGE, PARENTAL_CONSENT_AGE } from "@/lib/age";
import styles from "@/components/auth/authContent.module.css";

const PROVIDER_NAMES = { google: "Google", apple: "Apple" } as const;

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return ageFromDob(d);
}

/**
 * "We don't know this address — do you want an account?"
 *
 * Confirming records the consent (a signed, short-lived cookie) and then sends
 * them back through the provider. That second trip is silent — they've already
 * consented at Google/Apple — and it's what proves the address again at the
 * moment the account is created. Nothing is written before the button.
 */
export default function SocialSignupForm({
  provider,
  email,
}: {
  provider: "google" | "apple";
  email: string;
}) {
  const [dob, setDob] = useState("");
  const [agree, setAgree] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);
  const [dobError, setDobError] = useState("");
  const [agreeError, setAgreeError] = useState("");
  const [guardianError, setGuardianError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enteredAge = ageFrom(dob);
  const needsGuardian =
    enteredAge !== null && enteredAge >= MIN_AGE && enteredAge < PARENTAL_CONSENT_AGE;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const age = ageFrom(dob);
    if (!dob) setDobError("Enter your date of birth.");
    else if (age === null) setDobError("Enter a valid date.");
    else if (age < MIN_AGE) setDobError(`You must be ${MIN_AGE} or older to play.`);
    else setDobError("");
    setAgreeError(agree ? "" : `Please confirm you’re ${MIN_AGE} or older.`);
    setGuardianError(
      needsGuardian && !parentalConsent
        ? "Please confirm a parent or guardian has given you permission."
        : ""
    );
    if (!dob || age === null || age < MIN_AGE || !agree) return;
    if (needsGuardian && !parentalConsent) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/social-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, email, dob, parentalConsent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t create your account. Please try again.");
        setSubmitting(false);
        return;
      }

      // Back through the provider. It proves the address one more time, and
      // that's the trip on which the account is actually created.
      void signIn(provider, { redirectTo: "/dashboard" });
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Create your account?</h1>
      <p className={styles.lede}>
        You signed in with {PROVIDER_NAMES[provider]} as <strong>{email}</strong>, and there’s no
        Last Man Standing account for that address yet. We haven’t created anything — say the
        word and we will.
      </p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={`lms-field ${dobError ? "lms-field--error" : ""}`}>
          <label className="lms-field__label" htmlFor="dob">
            Date of birth
            <span className="lms-field__req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            className="lms-field__control"
            id="dob"
            type="date"
            autoComplete="bday"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            aria-invalid={!!dobError}
            aria-describedby="dob-help"
            aria-required="true"
          />
          <p className="lms-field__help" id="dob-help" role={dobError ? "alert" : undefined}>
            {dobError ||
              `${PROVIDER_NAMES[provider]} doesn’t tell us this, and we check it to confirm you’re ${MIN_AGE} or older.`}
          </p>
        </div>

        <div className={`lms-field ${agreeError ? "lms-field--error" : ""}`}>
          <label className="lms-check">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              aria-invalid={!!agreeError}
              aria-describedby="agree-help"
            />
            <span>I confirm I am {MIN_AGE} years of age or older.</span>
          </label>
          <p className="lms-field__help" id="agree-help" role={agreeError ? "alert" : undefined}>
            {agreeError}
          </p>
        </div>

        {needsGuardian && (
          <div className={`lms-field ${guardianError ? "lms-field--error" : ""}`}>
            <label className="lms-check">
              <input
                type="checkbox"
                checked={parentalConsent}
                onChange={(e) => setParentalConsent(e.target.checked)}
                aria-invalid={!!guardianError}
                aria-describedby="guardian-help"
              />
              <span>A parent or guardian has given me permission to play.</span>
            </label>
            <p
              className="lms-field__help"
              id="guardian-help"
              role={guardianError ? "alert" : undefined}
            >
              {guardianError || `Asked of players under ${PARENTAL_CONSENT_AGE}.`}
            </p>
          </div>
        )}

        {error && (
          <p className="lms-field__help" data-error="true" role="alert">
            {error}
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
              Creating account&hellip;
            </>
          ) : (
            "Create my account"
          )}
        </button>
      </form>

      <p className={styles.alt}>
        Already have an account under a different address?{" "}
        <Link href="/login">Log in instead</Link>
      </p>
      <p className={styles.alt}>
        By creating an account, you agree to our <Link href="/policy">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}
