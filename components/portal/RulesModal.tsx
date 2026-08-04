"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./RulesModal.module.css";

const STEPS = [
  {
    n: "1",
    title: "Pick a team",
    body: "Each game week, choose one Premier League team you think will win.",
  },
  {
    n: "2",
    title: "Survive the week",
    body: "If your team wins, you go through. If they draw or lose, you’re knocked out.",
  },
  {
    n: "3",
    title: "Never pick twice",
    body: "You can only use each team once all game, so save your strongest sides for the tough weeks.",
  },
  {
    n: "4",
    title: "Last one standing",
    body: "Keep surviving week after week. When a single player is left, they win the whole game.",
  },
];

const EXTRAS = [
  {
    k: "Wildcard",
    v: "You get one per game. Play it with your pick on a tricky week and a draw is enough to go through — only a loss knocks you out. You can take it back any time before the deadline.",
  },
  {
    k: "Postponed match",
    v: "If your team’s game is called off, you’re counted as safe and go through to the next week.",
  },
  {
    k: "Everyone out",
    v: "If every remaining player falls in the same week, nobody wins and a fresh game begins.",
  },
];

export default function RulesModal() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function show() {
    ref.current?.showModal();
    setOpen(true);
  }
  function close() {
    ref.current?.close();
  }

  // Lock background scroll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={show}
        aria-haspopup="dialog"
      >
        <svg
          className={styles.triggerIcon}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M9.6 9.3a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1.9-1.1 1.7v.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="16.4" r="0.9" fill="currentColor" />
        </svg>
        <span className={styles.triggerLabel}>How to play</span>
      </button>

      <dialog
        ref={ref}
        className={styles.dialog}
        aria-labelledby="rules-title"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        onClick={(e) => {
          // Close when the backdrop (the dialog element itself) is clicked,
          // not when a click lands inside the panel.
          if (e.target === ref.current) close();
        }}
      >
        <div className={styles.panel}>
          <header className={styles.head}>
            <div>
              <p className={styles.kicker}>Last Man Standing</p>
              <h2 id="rules-title" className={styles.title}>
                How to play
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

          <div className={styles.content}>
            <ol className={styles.steps}>
              {STEPS.map((s) => (
                <li key={s.n} className={styles.step}>
                  <span className={styles.stepN} data-nums aria-hidden="true">
                    {s.n}
                  </span>
                  <div>
                    <h3 className={styles.stepTitle}>{s.title}</h3>
                    <p className={styles.stepBody}>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className={styles.extras}>
              {EXTRAS.map((r) => (
                <div key={r.k} className={styles.extra}>
                  <h4 className={styles.extraK}>{r.k}</h4>
                  <p className={styles.extraV}>{r.v}</p>
                </div>
              ))}
            </div>
          </div>

          <footer className={styles.foot}>
            <button
              type="button"
              className="lms-btn lms-btn--primary lms-btn--block"
              onClick={close}
            >
              Got it
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
