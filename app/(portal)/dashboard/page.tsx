"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortalState } from "@/components/portal/usePortalState";
import { TeamCrest } from "@/components/portal/TeamCrest";
import styles from "./page.module.css";

function useCountUp(target: number, on: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!on) return;
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
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
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
  const { state, loading, error, refetch } = usePortalState();
  const [ready, setReady] = useState(false);
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    if (state) setReady(true);
  }, [state]);

  if (loading) {
    return (
      <main className={styles.main}>
        <div className="lms-state">
          <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
          <p className="lms-state__body">Loading the game…</p>
        </div>
      </main>
    );
  }

  if (error || !state) {
    return (
      <main className={styles.main}>
        <div className="lms-state">
          <h1 className="lms-state__title">Something went wrong</h1>
          <p className="lms-state__body">{error ?? "Please try again."}</p>
          <button className="lms-btn lms-btn--primary" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!state.game) {
    return (
      <main className={styles.main}>
        <div className="lms-state">
          <h1 className="lms-state__title">No game running</h1>
          <p className="lms-state__body">
            There isn’t a game on right now. Check back soon. A new one starts when the admin
            opens registration.
          </p>
        </div>
      </main>
    );
  }

  const { game, entry, players, standings, myPick, pickGameWeek } = state;

  async function join() {
    setJoining(true);
    await fetch("/api/games/join", { method: "POST" });
    await refetch();
    setJoining(false);
  }

  const wildcardsLeft = entry ? (entry.wildcardUsed ? 0 : 1) : 0;

  return (
    <main className={styles.main}>
      <div className={styles.head}>
        <div>
          <p className={styles.kicker} data-nums>
            Game {game.no} &middot; Week {game.gameWeek}
          </p>
          <h1 className={styles.title}>
            {entry?.status === "winner"
              ? "You won this game 🏆"
              : entry?.status === "eliminated"
                ? "You’re out of this game."
                : entry
                  ? "You’re still standing."
                  : "The game is on."}
          </h1>
        </div>
        {entry?.status === "alive" && game.status !== "finished" && (
          <Link href="/make-selection" className="lms-btn lms-btn--primary">
            Make your Week {pickGameWeek} pick
          </Link>
        )}
        {!entry && game.status === "registration" && (
          <button
            className="lms-btn lms-btn--primary"
            onClick={join}
            disabled={joining}
            aria-disabled={joining}
          >
            {joining ? "Joining…" : "Join this game"}
          </button>
        )}
      </div>

      {entry && (
        <section className={styles.stats} aria-label="Your game at a glance">
          <Stat value={players.alive} label={`of ${players.total} still standing`} on={ready} />
          <Stat value={entry.survivedWeeks} label="weeks survived" on={ready} />
          <Stat value={wildcardsLeft} label="wildcard left" on={ready} />
          <div className={styles.stat}>
            <div className={styles.pickNum}>
              {myPick?.isWildcard ? "Wildcard" : myPick?.teamName ?? "Not set"}
            </div>
            <div className="lms-stat__label">your Week {pickGameWeek} pick</div>
          </div>
        </section>
      )}

      {!entry && game.status === "active" && (
        <p className={styles.notice}>
          This game already kicked off. You’ll be able to join the next one.
        </p>
      )}

      <section aria-label="Standings">
        <div className="lms-head">
          <h2 className="lms-head__title">Standings</h2>
          <p className="lms-head__hint">
            Survive each week to climb. When one player is left, they win the game.
          </p>
        </div>

        {standings.length === 0 ? (
          <p className={styles.notice}>No players yet. Be the first to join.</p>
        ) : (
          <ul className={styles.board}>
            {standings.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className={styles.row}
                data-you={p.you}
                data-out={p.status !== "alive"}
              >
                <span className={styles.rank} data-nums aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.player}>
                  <span className={styles.pname}>
                    {p.name}
                    {p.you && <span className={styles.youTag}>you</span>}
                  </span>
                  <span className={styles.psub} data-nums>
                    survived {p.survivedWeeks} {p.survivedWeeks === 1 ? "week" : "weeks"}
                  </span>
                </span>
                <span className={styles.lastPick}>
                  {p.lastTeamTla ? (
                    <>
                      <TeamCrest crest={p.lastTeamCrest} tla={p.lastTeamTla} />
                      <span className={styles.pickName}>{p.lastTeamName}</span>
                    </>
                  ) : (
                    <span className={styles.pickName}>—</span>
                  )}
                </span>
                <span
                  className={`lms-chip ${p.status === "alive" ? "lms-chip--safe" : "lms-chip--out"}`}
                >
                  <span className="lms-dot" aria-hidden="true" />
                  {p.status === "winner" ? "Winner" : p.status === "alive" ? "In" : "Out"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
