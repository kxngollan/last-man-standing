"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type SubmitEventHandler,
} from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { WhistleArt, ShieldCheckArt } from "@/components/ui/FootballArt";
import styles from "./ReportIssueModal.module.css";

export type ReportIssueModalHandle = { open: () => void };

const CATEGORIES = [
  { key: "bug", label: "Bug" },
  { key: "scores", label: "Wrong result" },
  { key: "account", label: "Account" },
  // The objectionable-content route. Names are the only thing one player can
  // put in front of another, so they're the only thing there is to report.
  { key: "player", label: "Player’s name" },
  { key: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["key"];

/**
 * "Blow the whistle" dialog — players report bugs and problems from the
 * account menu (no auto-prompt; that's the feedback modal's job). Captures
 * the pathname they were on so the report lands with context.
 */
export default function ReportIssueModal({ ref }: { ref?: Ref<ReportIssueModalHandle> }) {
  const { status } = useSession();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"form" | "thanks">("form");
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        if (dialogRef.current?.open) return;
        setView("form");
        setError("");
        dialogRef.current?.showModal();
        setOpen(true);
      },
    }),
    []
  );

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

  const submit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (category === null || !message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: message.trim(), page: pathname ?? "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Couldn’t send that. Please try again.");
        return;
      }
      setView("thanks");
      setCategory(null);
      setMessage("");
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
      aria-labelledby="issue-title"
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onClick={(e) => {
        // Backdrop dismiss: the dialog element itself is the bare area.
        if (e.target === dialogRef.current) close();
      }}
    >
      <div className={styles.panel}>
        {view === "thanks" ? (
          <div className={styles.thanks} role="status">
            <ShieldCheckArt className={styles.thanksArt} />
            <h2 className={styles.title}>Got it — we&rsquo;re on it.</h2>
            <p className={styles.lede}>Thanks for flagging it. We&rsquo;ll take a look.</p>
          </div>
        ) : (
          <>
            <header className={styles.head}>
              <WhistleArt className={styles.whistle} />
              <div className={styles.headText}>
                <p className={styles.kicker}>Blow the whistle</p>
                <h2 id="issue-title" className={styles.title}>
                  Report an issue
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
                className={styles.cats}
                role="radiogroup"
                aria-label="What kind of problem is it?"
              >
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={category === c.key}
                    className={styles.cat}
                    data-selected={category === c.key}
                    disabled={sending}
                    onClick={() => setCategory(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="lms-field">
                <label className="lms-field__label" htmlFor="issue-message">
                  What happened?
                </label>
                <textarea
                  className={`lms-field__control ${styles.textarea}`}
                  id="issue-message"
                  rows={4}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                  aria-required="true"
                />
                <p className={`lms-field__help ${styles.pageNote}`} data-nums>
                  We&rsquo;ll note you were on {pathname ?? "this page"}.
                </p>
              </div>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="lms-btn lms-btn--primary lms-btn--block"
                disabled={category === null || !message.trim() || sending}
                aria-disabled={category === null || !message.trim() || sending}
              >
                {sending ? (
                  <>
                    <span className="lms-spinner" aria-hidden="true" />
                    Sending&hellip;
                  </>
                ) : (
                  "Send report"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
