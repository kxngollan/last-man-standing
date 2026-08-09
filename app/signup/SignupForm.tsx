"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";
import { useCooldown } from "@/components/auth/useCooldown";
import isEmail from "@/lib/isEmail";
import { ageFromDob, MIN_AGE } from "@/lib/age";
import styles from "@/components/auth/authContent.module.css";

type Fields = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
  dob: string;
  agree: boolean;
};

type Errors = Partial<Record<keyof Fields, string>>;

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return ageFromDob(d);
}

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.firstName.trim())
    e.firstName = "Enter your first name — it’s how other players will see you.";
  if (!f.lastName.trim()) e.lastName = "Enter your last name.";
  if (!f.email.trim()) e.email = "Enter your email. We’ll send a confirmation link.";
  else if (!isEmail(f.email)) e.email = "That doesn’t look like a valid email address.";
  if (!f.password) e.password = "Choose a password.";
  else if (f.password.length < 8) e.password = "Use at least 8 characters.";
  if (f.confirm !== f.password) e.confirm = "Passwords don’t match.";
  const age = ageFrom(f.dob);
  if (!f.dob) e.dob = "Enter your date of birth.";
  else if (age === null) e.dob = "Enter a valid date.";
  else if (age < MIN_AGE) e.dob = `You must be ${MIN_AGE} or older to play.`;
  if (!f.agree) e.agree = `Please confirm you’re ${MIN_AGE} or older.`;
  return e;
}

export default function SignupForm({ inviter }: { inviter?: string | null }) {
  const [fields, setFields] = useState<Fields>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirm: "",
    dob: "",
    agree: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState("");
  const { remaining, start } = useCooldown();

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (touched[key]) setErrors(validate(next));
  }

  function blur(key: keyof Fields) {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors(validate(fields));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const errs = validate(fields);
    setErrors(errs);
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirm: true,
      dob: true,
      agree: true,
    });
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: fields.firstName,
          lastName: fields.lastName,
          email: fields.email,
          password: fields.password,
          dob: fields.dob,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setErrors((e) => ({ ...e, email: data.error ?? "That email is already taken." }));
        }
        const base = data.error ?? "Couldn’t create your account. Please try again.";
        // `detail` is only present in development — shows the raw cause.
        setServerError(data.detail ? `${base}: ${data.detail}` : base);
        return;
      }
      setDone(true);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResendError("");
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fields.email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResendError(data.error ?? "Couldn’t resend the email. Please try again.");
        return;
      }
      start(30);
    } catch {
      setResendError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (done) {
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
          <h1 className={styles.title}>Check your inbox</h1>
          <p className={styles.lede}>
            We&rsquo;ve sent a confirmation link to <strong>{fields.email}</strong>. Click it to
            verify your account, then log in and join the next game.
          </p>
          <Link href="/login" className="lms-btn lms-btn--primary lms-btn--block">
            Log in
          </Link>
          {resendError && (
            <p className={styles.alt} role="alert">
              {resendError}
            </p>
          )}
          <button
            type="button"
            className="lms-btn lms-btn--ghost lms-btn--block"
            onClick={resend}
            disabled={resending || remaining > 0}
            aria-disabled={resending || remaining > 0}
          >
            {remaining > 0
              ? `Email sent — resend in ${remaining}s`
              : resending
                ? "Sending…"
                : "Didn’t get it? Resend email"}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {/* The share card promises "X has invited you" — say so here too, or
          arriving on a generic page reads like the link went wrong. */}
      {inviter && (
        <p className={styles.invite}>
          <strong>{inviter}</strong> invited you to play.
        </p>
      )}
      <h1 className={styles.title}>Create your account</h1>
      <p className={styles.lede}>Free to play. You must be 16 or older to sign up.</p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={`lms-field ${errors.firstName ? "lms-field--error" : ""}`}>
          <label className="lms-field__label" htmlFor="firstName">
            First name<span className="lms-field__req" aria-hidden="true">*</span>
          </label>
          <input
            className="lms-field__control"
            id="firstName"
            type="text"
            autoComplete="given-name"
            value={fields.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            onBlur={() => blur("firstName")}
            aria-invalid={!!errors.firstName}
            aria-describedby="firstName-help"
            aria-required="true"
          />
          <p className="lms-field__help" id="firstName-help">
            {errors.firstName ?? ""}
          </p>
        </div>

        <div className={`lms-field ${errors.lastName ? "lms-field--error" : ""}`}>
          <label className="lms-field__label" htmlFor="lastName">
            Last name<span className="lms-field__req" aria-hidden="true">*</span>
          </label>
          <input
            className="lms-field__control"
            id="lastName"
            type="text"
            autoComplete="family-name"
            value={fields.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            onBlur={() => blur("lastName")}
            aria-invalid={!!errors.lastName}
            aria-describedby="lastName-help"
            aria-required="true"
          />
          <p className="lms-field__help" id="lastName-help">
            {errors.lastName ?? ""}
          </p>
          <p className="lms-field__help">
            Other players see your first name and last initial, e.g. “Sam K.”
          </p>
        </div>

        <div className={`lms-field ${errors.email ? "lms-field--error" : ""}`}>
          <label className="lms-field__label" htmlFor="email">
            Email<span className="lms-field__req" aria-hidden="true">*</span>
          </label>
          <input
            className="lms-field__control"
            id="email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => blur("email")}
            aria-invalid={!!errors.email}
            aria-describedby="email-help"
            aria-required="true"
          />
          <p className="lms-field__help" id="email-help">
            {errors.email ?? ""}
          </p>
        </div>

        <PasswordInput
          id="password"
          label="Password"
          required
          autoComplete="new-password"
          value={fields.password}
          onChange={(v) => update("password", v)}
          onBlur={() => blur("password")}
          error={errors.password}
          helper="At least 8 characters."
        />

        <PasswordInput
          id="confirm"
          label="Confirm password"
          required
          autoComplete="new-password"
          value={fields.confirm}
          onChange={(v) => update("confirm", v)}
          onBlur={() => blur("confirm")}
          error={errors.confirm}
        />

        <div className={`lms-field ${errors.dob ? "lms-field--error" : ""}`}>
          <label className="lms-field__label" htmlFor="dob">
            Date of birth<span className="lms-field__req" aria-hidden="true">*</span>
          </label>
          <input
            className="lms-field__control"
            id="dob"
            type="date"
            autoComplete="bday"
            value={fields.dob}
            onChange={(e) => update("dob", e.target.value)}
            onBlur={() => blur("dob")}
            aria-invalid={!!errors.dob}
            aria-describedby="dob-help"
            aria-required="true"
          />
          <p className="lms-field__help" id="dob-help">
            {errors.dob ?? "We check this to confirm you’re 16 or older."}
          </p>
        </div>

        <div className={`lms-field ${errors.agree ? "lms-field--error" : ""}`}>
          <label className="lms-check">
            <input
              type="checkbox"
              checked={fields.agree}
              onChange={(e) => update("agree", e.target.checked)}
              onBlur={() => blur("agree")}
              aria-invalid={!!errors.agree}
              aria-describedby="agree-help"
            />
            <span>I confirm I am 16 years of age or older.</span>
          </label>
          <p className="lms-field__help" id="agree-help">
            {errors.agree ?? ""}
          </p>
        </div>

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
              Creating account&hellip;
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className={styles.alt}>
        By creating an account, you agree to our <Link href="/policy">Privacy Policy</Link>.
      </p>
      <p className={styles.alt}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
