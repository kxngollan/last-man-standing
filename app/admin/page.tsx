"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type PastGame = {
  no: number;
  outcome: string;
  tone: "safe" | "out";
  weeks: number;
};

const PAST_GAMES: PastGame[] = [
  { no: 3, outcome: "Won by Priya Nair", tone: "safe", weeks: 7 },
  { no: 2, outcome: "No winner — all out Week 4, restarted", tone: "out", weeks: 4 },
  { no: 1, outcome: "Won by Tom Okafor", tone: "safe", weeks: 9 },
];

export default function AdminPage() {
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [startWeek, setStartWeek] = useState("4");
  const [openReg, setOpenReg] = useState(true);

  function processResults() {
    if (processing) return;
    setProcessing(true);
    // Simulated run of resolveMatchday() against football-data.org results.
    setTimeout(() => {
      setProcessing(false);
      setProcessed(true);
    }, 900);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <span className={styles.tag}>Admin</span>
        <Link href="/dashboard" className={styles.back}>
          ← Back to app
        </Link>
      </header>

      <main className={styles.main}>
        <div className="lms-head">
          <h1 className={styles.title}>Game control</h1>
          <p className="lms-head__hint">
            Results resolve automatically after each game week. Use the controls below to run a
            resolution early or start a new game.
          </p>
        </div>

        <div className={styles.grid}>
          {/* Current game — the primary panel */}
          <section className={`lms-panel lms-panel--ink ${styles.current}`}>
            <div className={styles.currentHead}>
              <span className={styles.currentKicker} data-nums>
                Game 4 &middot; Week 3
              </span>
              <span className="lms-chip lms-chip--safe">
                <span className="lms-dot" aria-hidden="true" />
                Active
              </span>
            </div>
            <p className={styles.big} data-nums>
              42<span className={styles.of}>/60</span>
            </p>
            <p className={styles.bigLabel}>players still standing</p>

            <div className={styles.actions}>
              <button
                type="button"
                className="lms-btn lms-btn--primary"
                onClick={processResults}
                disabled={processing || processed}
                aria-disabled={processing || processed}
              >
                {processing ? (
                  <>
                    <span className="lms-spinner" aria-hidden="true" />
                    Processing&hellip;
                  </>
                ) : processed ? (
                  "Week 3 resolved ✓"
                ) : (
                  "Process Week 3 results"
                )}
              </button>
              <button type="button" className={`lms-btn ${styles.ghostOnInk}`}>
                View entries
              </button>
            </div>
            {processed && (
              <p className={styles.resolved} role="status" data-nums>
                18 eliminated &middot; 24 through to Week 4.
              </p>
            )}
          </section>

          {/* Start a new game */}
          <section className={`lms-panel ${styles.panel}`}>
            <h2 className={styles.panelTitle}>Start a new game</h2>
            <p className={styles.panelHint}>
              A new global game opens registration, then kicks off at the chosen game week.
            </p>
            <form
              className={styles.startForm}
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="lms-field">
                <label className="lms-field__label" htmlFor="startWeek">
                  Start at game week
                </label>
                <input
                  className="lms-field__control"
                  id="startWeek"
                  type="number"
                  min="1"
                  max="38"
                  value={startWeek}
                  onChange={(e) => setStartWeek(e.target.value)}
                />
                <p className="lms-field__help">Premier League matchday (1–38).</p>
              </div>
              <label className="lms-check">
                <input
                  type="checkbox"
                  checked={openReg}
                  onChange={(e) => setOpenReg(e.target.checked)}
                />
                <span>Open registration immediately</span>
              </label>
              <button type="submit" className="lms-btn lms-btn--ghost lms-btn--block" disabled>
                Start game (a game is already active)
              </button>
            </form>
          </section>

          {/* Past games */}
          <section className={`lms-panel ${styles.past}`}>
            <h2 className={styles.panelTitle}>Past games</h2>
            <ul className={styles.pastList}>
              {PAST_GAMES.map((g) => (
                <li key={g.no} className={styles.pastRow}>
                  <span className={styles.pastNo} data-nums>
                    Game {g.no}
                  </span>
                  <span className={styles.pastOutcome}>{g.outcome}</span>
                  <span className={styles.pastWeeks} data-nums>
                    {g.weeks} wks
                  </span>
                  <span
                    className={`lms-chip ${g.tone === "safe" ? "lms-chip--safe" : "lms-chip--out"}`}
                  >
                    {g.tone === "safe" ? "Winner" : "Restarted"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
