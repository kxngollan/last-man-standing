"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShareLink from "@/app/(portal)/profile/ShareLink";
import styles from "./settings.module.css";

/**
 * Your referral link. Changing the handle rewrites the row, so anything already
 * shared stops working — the copy says so plainly rather than letting people
 * find out from a friend who couldn't sign up.
 */
export default function ReferralSettings({
  handle,
  siteHost,
  hideFromBoard,
}: {
  handle: string;
  siteHost: string;
  hideFromBoard: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(handle);
  const [hidden, setHidden] = useState(hideFromBoard);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  const unchanged = value.trim().toLowerCase() === handle.toLowerCase();

  async function send(body: Record<string, unknown>, okMessage: string) {
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const res = await fetch("/api/me/referral", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn’t save that.");
        return false;
      }
      setSaved(okMessage);
      router.refresh();
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await send({ referralHandle: value.trim().toLowerCase() }, "Link updated.");
  }

  async function toggleBoard(next: boolean) {
    setHidden(next);
    const ok = await send(
      { hideFromBoard: next },
      next ? "You’re off the leaderboard." : "You’re on the leaderboard."
    );
    if (!ok) setHidden(!next); // put the switch back if the server refused
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.linkRow}>
        <code className={styles.link}>
          {siteHost}/r/{handle}
        </code>
        <ShareLink path={`/r/${handle}`} label="Copy link" copiedLabel="Copied" />
      </div>

      <div className={`lms-field ${error ? "lms-field--error" : ""}`}>
        <label className="lms-field__label" htmlFor="referralHandle">
          Your link
        </label>
        <input
          className="lms-field__control"
          id="referralHandle"
          type="text"
          value={value}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="referralHandle-help"
        />
        <p className="lms-field__help" id="referralHandle-help" role={error ? "alert" : undefined}>
          {error || "Letters, numbers and hyphens. 3–30 characters."}
        </p>
      </div>

      <p className={styles.warn}>
        Changing this breaks every link you&rsquo;ve already shared, and frees the old one for
        someone else to take.
      </p>

      <label className="lms-check">
        <input
          type="checkbox"
          checked={!hidden}
          disabled={saving}
          onChange={(e) => void toggleBoard(!e.target.checked)}
        />
        Show me on the referral leaderboard
      </label>

      {saved && (
        <p className={styles.ok} role="status">
          {saved}
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
          "Save link"
        )}
      </button>
    </form>
  );
}
