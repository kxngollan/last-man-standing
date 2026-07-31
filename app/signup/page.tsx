"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";
import styles from "@/components/auth/authContent.module.css";

type Fields = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  dob: string;
  agree: boolean;
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter your name so other players can see who they’re up against.";
  if (!f.email.trim()) e.email = "Enter your email. We’ll send a confirmation link.";
  else if (!EMAIL_RE.test(f.email)) e.email = "That doesn’t look like a valid email address.";
  if (!f.password) e.password = "Choose a password.";
  else if (f.password.length < 8) e.password = "Use at least 8 characters.";
  if (f.confirm !== f.password) e.confirm = "Passwords don’t match.";
  const age = ageFrom(f.dob);
  if (!f.dob) e.dob = "Enter your date of birth.";
  else if (age === null) e.dob = "Enter a valid date.";
  else if (age < 16) e.dob = "You must be 16 or older to play.";
  if (!f.agree) e.agree = "Please confirm you’re 16 or older.";
  return e;
}

export default function SignupPage() {
  const [fields, setFields] = useState<Fields>({
    name: "",
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
    setTouched({ name: true, email: true, password: true, confirm: true, dob: true, agree: true });
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name,
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
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.lede}>
            We&rsquo;ve sent a confirmation link to <strong>{fields.email}</strong>. Click it to
            verify your account &mdash; you&rsquo;ll be able to join the next game once
            you&rsquo;re confirmed.
          </p>
          <Link href="/login" className="lms-btn lms-btn--ghost lms-btn--block">
            Back to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Create your account</h1>
      <p className={styles.lede}>Free to play. You must be 16 or older to sign up.</p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={`lms-field ${errors.name ? "lms-field--error" : ""}`}>
          <label className="lms-field__label" htmlFor="name">
            Name<span className="lms-field__req" aria-hidden="true">*</span>
          </label>
          <input
            className="lms-field__control"
            id="name"
            type="text"
            autoComplete="name"
            value={fields.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={() => blur("name")}
            aria-invalid={!!errors.name}
            aria-describedby="name-help"
            aria-required="true"
          />
          <p className="lms-field__help" id="name-help">
            {errors.name ?? ""}
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
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
