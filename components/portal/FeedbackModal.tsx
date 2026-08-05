"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type SubmitEventHandler,
} from "react";
import { useSession } from "next-auth/react";
import { BuntingArt, TrophyArt } from "@/components/ui/FootballArt";
import styles from "./FeedbackModal.module.css";

export type FeedbackModalHandle = { open: () => void };

/** Snooze bookkeeping — one localStorage timestamp, in ms since epoch. */
const SNOOZE_KEY = "lms-feedback-next";
const DAY_MS = 24 * 60 * 60 * 1000;
const SEED_DELAY = 3 * DAY_MS; // never prompt a brand-new visitor on day one
const DISMISS_SNOOZE = 7 * DAY_MS;
const SUBMIT_SNOOZE = 90 * DAY_MS;
const PROMPT_DELAY_MS = 10_000; // let them settle in before asking

function snoozeFor(ms: number) {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms));
  } catch {
    /* private mode — the prompt just won't throttle */
  }
}

const RATING_WORDS: Record<number, string> = {
  1: "Rough",
  2: "Not great",
  3: "It’s okay",
  4: "Good fun",
  5: "Brilliant",
};

/**
 * Occasional "how's the game?" dialog for signed-in players. Auto-prompts at
 * most once a week (quiet for 90 days after a submission) and can be opened
 * any time from the account menu via the `open()` ref handle — a manual open
 * never rewrites the snooze unless the player actually submits.
 */
export default function FeedbackModal({ ref }: { ref?: Ref<FeedbackModalHandle> }) {
  const { status } = useSession();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const promptedRef = useRef(false); // this showing was the auto-prompt
  const submittedRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"form" | "thanks">("form");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function show(fromPrompt: boolean) {
    if (dialogRef.current?.open) return;
    promptedRef.current = fromPrompt;
    submittedRef.current = false;
    setView("form");
    setError("");
    dialogRef.current?.showModal();
    setOpen(true);
  }

  useImperativeHandle(ref, () => ({ open: () => show(false) }), []);

  // The weekly-ish auto-prompt, signed-in players only.
  useEffect(() => {
    if (status !== "authenticated") return;
    let due: number;
    try {
      due = Number(localStorage.getItem(SNOOZE_KEY));
    } catch {
      return;
    }
    if (!Number.isFinite(due) || due === 0) {
      snoozeFor(SEED_DELAY);
      return;
    }
    if (Date.now() < due) return;
    const t = setTimeout(() => show(true), PROMPT_DELAY_MS);
    return () => clearTimeout(t);
  }, [status]);

  // Lock background scroll while the dialog is open (RulesModal pattern).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    dialogRef.current?.close();
  }

  function handleClosed() {
    setOpen(false);
    // Dismissing the auto-prompt snoozes a week; submitting already set 90
    // days; closing a manually opened dialog changes nothing.
    if (!submittedRef.current && promptedRef.current) snoozeFor(DISMISS_SNOOZE);
    if (submittedRef.current) {
      setRating(null);
      setMessage("");
    }
  }

  const submit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (rating === null || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          ...(message.trim() ? { message: message.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Couldn’t send that. Please try again.");
        return;
      }
      submittedRef.current = true;
      snoozeFor(SUBMIT_SNOOZE);
      setView("thanks");
      setTimeout(close, 1800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (status !== "authenticated") return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="feedback-title"
      onClose={handleClosed}
      onCancel={handleClosed}
      onClick={(e) => {
        // Backdrop dismiss: the dialog element itself is the bare area.
        if (e.target === dialogRef.current) close();
      }}
    >
      <div className={styles.panel}>
        <BuntingArt className={styles.bunting} />

        {view === "thanks" ? (
          <div className={styles.thanks} role="status">
            <TrophyArt className={styles.thanksArt} />
            <h2 className={styles.title}>Thanks — noted.</h2>
            <p className={styles.lede}>Every bit of it makes the game better.</p>
          </div>
        ) : (
          <>
            <header className={styles.head}>
              <div>
                <p className={styles.kicker}>Quick one</p>
                <h2 id="feedback-title" className={styles.title}>
                  How&rsquo;s the game treating you?
                </h2>
              </div>
              <button
                type="button"
                className={styles.close}
                aria-label="Close"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <form className={styles.body} onSubmit={submit}>
              <div
                className={styles.ratingRow}
                role="radiogroup"
                aria-label="Rate the game, 1 to 5"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} out of 5 — ${RATING_WORDS[n]}`}
                    className={styles.ratingDisc}
                    data-selected={rating === n}
                    disabled={sending}
                    onClick={() => setRating(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className={styles.ratingWord} data-nums aria-hidden="true">
                {rating ? RATING_WORDS[rating] : " "}
              </p>

              <div className="lms-field">
                <label className="lms-field__label" htmlFor="feedback-message">
                  Anything we should fix or add?{" "}
                  <span className={styles.optional}>(optional)</span>
                </label>
                <textarea
                  className={`lms-field__control ${styles.textarea}`}
                  id="feedback-message"
                  rows={3}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                />
              </div>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="lms-btn lms-btn--primary lms-btn--block"
                disabled={rating === null || sending}
                aria-disabled={rating === null || sending}
              >
                {sending ? (
                  <>
                    <span className="lms-spinner" aria-hidden="true" />
                    Sending&hellip;
                  </>
                ) : (
                  "Send feedback"
                )}
              </button>
              <button
                type="button"
                className={styles.later}
                onClick={close}
                disabled={sending}
              >
                Maybe later
              </button>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
