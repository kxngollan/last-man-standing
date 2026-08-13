"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import PasswordInput from "@/components/ui/PasswordInput";
import styles from "./settings.module.css";

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  helper,
  autoComplete,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  helper?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  const helpId = `${id}-help`;
  return (
    <div className={`lms-field ${error ? "lms-field--error" : ""}`}>
      <label className="lms-field__label" htmlFor={id}>
        {label}
        <span className="lms-field__req" aria-hidden="true">
          *
        </span>
      </label>
      <input
        className="lms-field__control"
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={helpId}
        aria-required="true"
      />
      <p className="lms-field__help" id={helpId} role={error ? "alert" : undefined}>
        {error ?? helper ?? ""}
      </p>
    </div>
  );
}

/**
 * Renaming yourself. On success the session is updated in place so the app bar
 * — which reads the name off the session — changes with everything else rather
 * than waiting for the next login.
 */
function NameForm({ firstName, lastName }: { firstName: string; lastName: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const unchanged = first.trim() === firstName && last.trim() === lastName;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (!first.trim() || !last.trim()) {
      setError("Enter both a first and last name.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: first.trim(), lastName: last.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t save your name.");
        return;
      }
      await update();
      router.refresh();
      setSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.row}>
        <TextField
          id="firstName"
          label="First name"
          value={first}
          onChange={setFirst}
          maxLength={40}
          autoComplete="given-name"
        />
        <TextField
          id="lastName"
          label="Last name"
          value={last}
          onChange={setLast}
          maxLength={40}
          autoComplete="family-name"
        />
      </div>

      {error && (
        <p className="lms-field__help" data-error="true" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className={styles.ok} role="status">
          Name saved.
        </p>
      )}

      <button
        type="submit"
        className="lms-btn lms-btn--primary"
        disabled={saving || unchanged}
        aria-disabled={saving || unchanged}
      >
        {saving ? (
          <>
            <span className="lms-spinner" aria-hidden="true" />
            Saving&hellip;
          </>
        ) : (
          "Save name"
        )}
      </button>
    </form>
  );
}

/**
 * Changing your password signs out every other device (see auth.ts). That
 * includes this one, so once it's done we sign back in with the new password
 * straight away — proving the new password is what earns the fresh session.
 */
function PasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nextError, setNextError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setDone(false);

    let bad = false;
    if (next.length < 8) {
      setNextError("Use at least 8 characters.");
      bad = true;
    } else setNextError(undefined);
    if (confirm !== next) {
      setConfirmError("Passwords don’t match.");
      bad = true;
    } else setConfirmError(undefined);
    if (bad) return;

    setSaving(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t change your password.");
        return;
      }

      // The old session died with the old password — take a new one.
      const result = await signIn("credentials", {
        email,
        password: next,
        redirect: false,
      });
      if (result?.error) {
        setNotice("Password changed. Please log in again with your new password.");
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <PasswordInput
        id="currentPassword"
        label="Current password"
        required
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
      />
      <PasswordInput
        id="newPassword"
        label="New password"
        required
        autoComplete="new-password"
        value={next}
        onChange={setNext}
        error={nextError}
        helper="At least 8 characters."
      />
      <PasswordInput
        id="confirmPassword"
        label="Confirm new password"
        required
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        error={confirmError}
      />

      {error && (
        <p className="lms-field__help" data-error="true" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className={styles.ok} role="status">
          {notice || "Password changed. Any other devices have been signed out."}
        </p>
      )}

      <button
        type="submit"
        className="lms-btn lms-btn--primary"
        disabled={saving}
        aria-disabled={saving}
      >
        {saving ? (
          <>
            <span className="lms-spinner" aria-hidden="true" />
            Changing&hellip;
          </>
        ) : (
          "Change password"
        )}
      </button>
    </form>
  );
}

/**
 * Deleting the account, for good.
 *
 * The typed word is the gate — there is deliberately no single click that ends
 * an account. It lives on the site as well as in the phone app because Play's
 * data deletion policy wants a route a person can reach in a browser, without
 * installing anything first.
 */
export function DeleteAccountForm() {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const ready = confirm.trim().toUpperCase() === "DELETE";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!ready) {
      setError("Type DELETE to confirm.");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t delete your account.");
        setDeleting(false);
        return;
      }
      // The claims would fail their next re-read regardless, since the account
      // they name has gone. Ending the session here means landing on the home
      // page rather than sitting in a portal that has lost its owner.
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <p className={styles.warn}>
        This deletes your account, your picks, your entries and your referrals. Games you played
        stay on the boards without you in them. It happens straight away and cannot be undone.
      </p>
      <TextField
        id="confirmDelete"
        label="Type DELETE to confirm"
        value={confirm}
        onChange={setConfirm}
        maxLength={10}
        error={error || undefined}
      />
      <button
        type="submit"
        className="lms-btn lms-btn--danger"
        disabled={deleting || !ready}
        aria-disabled={deleting || !ready}
      >
        {deleting ? (
          <>
            <span className="lms-spinner" aria-hidden="true" />
            Deleting&hellip;
          </>
        ) : (
          "Delete my account"
        )}
      </button>
    </form>
  );
}

export default function SettingsForms({
  firstName,
  lastName,
  email,
  hasPassword,
}: {
  firstName: string;
  lastName: string;
  email: string;
  hasPassword: boolean;
}) {
  return (
    <>
      <section className={styles.block} aria-labelledby="name-heading">
        <div className="lms-head">
          <h2 className="lms-head__title" id="name-heading">
            Your name
          </h2>
          <p className="lms-head__hint">
            This is how you appear to other players — as &ldquo;
            {firstName || "First"} {(lastName || "L")[0]}.&rdquo; on the standings and your
            profile. Changing it changes how you appear in past games too.
          </p>
        </div>
        <NameForm firstName={firstName} lastName={lastName} />
      </section>

      <section className={styles.block} aria-labelledby="password-heading">
        <div className="lms-head">
          <h2 className="lms-head__title" id="password-heading">
            Password
          </h2>
          <p className="lms-head__hint">
            {hasPassword ? (
              <>
                You&rsquo;ll need your current password. Changing it signs out every other
                device and sends a note to your email address.
              </>
            ) : (
              <>
                You sign in with Google or Apple, so there&rsquo;s no password on this account.
                You can still give it one — <Link href="/forgot">send yourself a link</Link> and
                choose a password. Signing in with Google or Apple keeps working either way.
              </>
            )}
          </p>
        </div>
        {hasPassword && <PasswordForm email={email} />}
      </section>
    </>
  );
}
