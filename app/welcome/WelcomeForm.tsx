"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import AuthShell from "@/components/auth/AuthShell";
import { ageFromDob, MIN_AGE, PARENTAL_CONSENT_AGE } from "@/lib/age";
import { safeNext } from "@/lib/safeNext";
import styles from "@/components/auth/authContent.module.css";

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return ageFromDob(d);
}

function Form({ firstName }: { firstName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const [dob, setDob] = useState("");
  const [agree, setAgree] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);
  const [dobError, setDobError] = useState("");
  const [agreeError, setAgreeError] = useState("");
  const [guardianError, setGuardianError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const enteredAge = ageFrom(dob);
  const needsGuardian =
    enteredAge !== null && enteredAge >= MIN_AGE && enteredAge < PARENTAL_CONSENT_AGE;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // The same checks the server applies, said sooner. The server's are the
    // ones that count.
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

    setSaving(true);
    try {
      const res = await fetch("/api/me/dob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, parentalConsent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t save that. Please try again.");
        return;
      }

      // Force the session to re-read its claims rather than waiting out the
      // five-minute TTL. The proxy trusts the session over the database, so
      // navigating before the claim has actually changed would bounce us
      // straight back here — check what comes back, and only go if it agrees.
      const session = await update();
      if (!session?.user || session.user.needsOnboarding) {
        setError(
          "Saved, but this session hasn’t caught up. Reload the page, or log out and back in."
        );
        return;
      }
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
      <p className={styles.lede}>
        One thing Google and Apple don&rsquo;t tell us: your date of birth. We need it to
        confirm you&rsquo;re old enough to play, and then you&rsquo;re in.
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
              `We check this to confirm you’re ${MIN_AGE} or older. It can’t be changed later.`}
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
          disabled={saving}
          aria-disabled={saving}
        >
          {saving ? (
            <>
              <span className="lms-spinner" aria-hidden="true" />
              Saving&hellip;
            </>
          ) : (
            "Start playing"
          )}
        </button>
      </form>
    </AuthShell>
  );
}

// useSearchParams needs a Suspense boundary, same as the login page.
export default function WelcomeForm({ firstName }: { firstName: string }) {
  return (
    <Suspense fallback={null}>
      <Form firstName={firstName} />
    </Suspense>
  );
}
