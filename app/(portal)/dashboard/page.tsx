"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

/* ---- Mock game state (stands in for the game engine) ---- */
const GAME_NO = 4;
const GAME_WEEK = 3;
const PLAYERS_LEFT = 42;
const PLAYERS_TOTAL = 60;
const WEEKS_SURVIVED = 2;
const WILDCARDS_LEFT = 1;
const YOUR_PICK = "Arsenal";

type Standing = {
  name: string;
  survived: number;
  lastPick: string;
  lastCode: string;
  color: string;
  status: "alive" | "out";
  you?: boolean;
};

const STANDINGS: Standing[] = [
  { name: "You", survived: 2, lastPick: "Arsenal", lastCode: "ARS", color: "oklch(55% 0.2 25)", status: "alive", you: true },
  { name: "Priya Nair", survived: 2, lastPick: "Man City", lastCode: "MCI", color: "oklch(52% 0.12 235)", status: "alive" },
  { name: "Tom Okafor", survived: 2, lastPick: "Liverpool", lastCode: "LIV", color: "oklch(52% 0.19 22)", status: "alive" },
  { name: "Sam Tan", survived: 2, lastPick: "Newcastle", lastCode: "NEW", color: "oklch(32% 0.01 0)", status: "alive" },
  { name: "Elena Ruiz", survived: 1, lastPick: "Chelsea", lastCode: "CHE", color: "oklch(48% 0.17 260)", status: "out" },
  { name: "Marcus Webb", survived: 1, lastPick: "Everton", lastCode: "EVE", color: "oklch(45% 0.15 260)", status: "out" },
  { name: "Aisha Bello", survived: 0, lastPick: "Wolves", lastCode: "WOL", color: "oklch(52% 0.13 72)", status: "out" },
];

function useCountUp(target: number, on: boolean) {
  const [value, setValue] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    if (!on) {
      setValue(target);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      ref.current = Math.round(eased * target);
      setValue(ref.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, on]);
  return value;
}

function Stat({ value, label, on }: { value: number; label: string; on: boolean }) {
  const shown = useCountUp(value, on);
  return (
    <div className={styles.stat}>
      <div className="lms-stat__num" data-nums aria-hidden="true">
        {shown}
      </div>
      <div className="lms-stat__label">
        <span className={styles.srOnly}>{value} </span>
        {label}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className={styles.main}>
      <div className={styles.head}>
        <div>
          <p className={styles.kicker} data-nums>
            Game {GAME_NO} &middot; Week {GAME_WEEK}
          </p>
          <h1 className={styles.title}>You&rsquo;re still standing.</h1>
        </div>
        <Link href="/make-selection" className="lms-btn lms-btn--primary">
          Make your Week {GAME_WEEK} pick
        </Link>
      </div>

      <section className={styles.stats} aria-label="Your game at a glance">
        <Stat value={PLAYERS_LEFT} label={`of ${PLAYERS_TOTAL} still standing`} on={mounted} />
        <Stat value={WEEKS_SURVIVED} label="weeks survived" on={mounted} />
        <Stat value={WILDCARDS_LEFT} label="wildcard left" on={mounted} />
        <div className={styles.stat}>
          <div className={styles.pickNum}>{YOUR_PICK}</div>
          <div className="lms-stat__label">your Week {GAME_WEEK} pick</div>
        </div>
      </section>

      <section aria-label="Standings">
        <div className="lms-head">
          <h2 className="lms-head__title">Standings</h2>
          <p className="lms-head__hint">
            Survive each week to climb. When one player is left, they win the game.
          </p>
        </div>

        <ul className={styles.board}>
          {STANDINGS.map((p, i) => (
            <li key={p.name} className={styles.row} data-you={p.you} data-out={p.status === "out"}>
              <span className={styles.rank} data-nums aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.player}>
                <span className={styles.pname}>
                  {p.name}
                  {p.you && <span className={styles.youTag}>you</span>}
                </span>
                <span className={styles.psub} data-nums>
                  survived {p.survived} {p.survived === 1 ? "week" : "weeks"}
                </span>
              </span>
              <span className={styles.lastPick}>
                <span className="lms-crest" style={{ background: p.color }} aria-hidden="true">
                  {p.lastCode}
                </span>
                <span className={styles.pickName}>{p.lastPick}</span>
              </span>
              <span
                className={`lms-chip ${p.status === "alive" ? "lms-chip--safe" : "lms-chip--out"}`}
              >
                <span className="lms-dot" aria-hidden="true" />
                {p.status === "alive" ? "In" : "Out"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
