"use client";

import Link from "next/link";
import { usePortalState } from "@/components/portal/usePortalState";
import { teamColor } from "@/lib/teamColor";
import { TEAMS_PER_GAME } from "@/lib/game/constants";
import styles from "./page.module.css";

const RESULT_META: Record<string, { chip: string; label: string; detail: string }> = {
  win: { chip: "lms-chip--safe", label: "Won", detail: "Won — through to the next week." },
  safe: { chip: "lms-chip--safe", label: "Safe", detail: "Safe this week." },
  postponed: { chip: "lms-chip--safe", label: "Safe", detail: "Match postponed — counted as safe." },
  draw: { chip: "lms-chip--out", label: "Out", detail: "Drew — knocked out here." },
  loss: { chip: "lms-chip--out", label: "Out", detail: "Lost — knocked out here." },
  pending: { chip: "lms-chip--neutral", label: "This week", detail: "Awaiting this week’s result." },
};

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.main}>
      <div className="lms-state">{children}</div>
    </main>
  );
}

export default function TeamPage() {
  const { state, loading, error, refetch } = usePortalState();

  if (loading) {
    return (
      <StateShell>
        <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
        <p className="lms-state__body">Loading your picks…</p>
      </StateShell>
    );
  }
  if (error || !state) {
    return (
      <StateShell>
        <h1 className="lms-state__title">Something went wrong</h1>
        <p className="lms-state__body">{error ?? "Please try again."}</p>
        <button className="lms-btn lms-btn--primary" onClick={() => refetch()}>
          Retry
        </button>
      </StateShell>
    );
  }
  if (!state.game || !state.entry) {
    return (
      <StateShell>
        <h1 className="lms-state__title">No picks yet</h1>
        <p className="lms-state__body">
          {state.game
            ? "Join the game from the dashboard to start picking."
            : "There’s no game running right now."}
        </p>
        <Link href="/dashboard" className="lms-btn lms-btn--primary">
          Go to dashboard
        </Link>
      </StateShell>
    );
  }

  const { game, entry, history } = state;
  const used = history.filter((h) => !h.isWildcard && h.tla);
  const alive = entry.status === "alive";

  return (
    <main className={styles.main}>
      <div className="lms-head">
        <p className={styles.kicker} data-nums>
          Game {game.no}
        </p>
        <h1 className={styles.title}>My picks</h1>
        <p className="lms-head__hint">
          Every team you pick is locked in for the game — you can’t use it again until a new game
          starts.
        </p>
      </div>

      {history.length === 0 ? (
        <p className="lms-head__hint">You haven’t made a pick yet this game.</p>
      ) : (
        <ol className={styles.timeline}>
          {history.map((p) => {
            const meta = p.isWildcard
              ? { chip: "lms-chip--wild", label: "Wildcard", detail: "Wildcard played — safe this week." }
              : RESULT_META[p.result] ?? RESULT_META.pending;
            return (
              <li key={p.matchday} className={styles.entry} data-pending={p.result === "pending"}>
                <div className={styles.marker} aria-hidden="true">
                  <span className={styles.gw} data-nums>
                    GW{p.gameWeek}
                  </span>
                </div>
                <div className={`lms-panel ${styles.card}`}>
                  <span
                    className="lms-crest lms-crest--lg"
                    style={{ background: teamColor(p.tla ?? "WC") }}
                    aria-hidden="true"
                  >
                    {p.isWildcard ? "WC" : p.tla}
                  </span>
                  <div className={styles.body}>
                    <div className={styles.teamLine}>
                      <span className={styles.team}>{p.isWildcard ? "Wildcard" : p.teamName}</span>
                    </div>
                    <p className={styles.detail}>{meta.detail}</p>
                  </div>
                  <span className={`lms-chip ${meta.chip}`}>{meta.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section className={styles.used} aria-label="Teams used this game">
        <h2 className={styles.usedTitle}>
          Teams used{" "}
          <span className={styles.usedCount} data-nums>
            ({used.length} of {TEAMS_PER_GAME})
          </span>
        </h2>
        {used.length === 0 ? (
          <p className={styles.usedHint}>None yet — all {TEAMS_PER_GAME} teams are available.</p>
        ) : (
          <>
            <ul className={styles.usedList}>
              {used.map((p) => (
                <li key={p.matchday} className={styles.usedItem}>
                  <span
                    className="lms-crest"
                    style={{ background: teamColor(p.tla ?? "") }}
                    aria-hidden="true"
                  >
                    {p.tla}
                  </span>
                  <span className={styles.usedName}>{p.teamName}</span>
                </li>
              ))}
            </ul>
            <p className={styles.usedHint}>
              {TEAMS_PER_GAME - used.length} teams still available. Choose wisely — you’ll want your
              strongest fixtures later.
            </p>
          </>
        )}
      </section>

      {alive && game.status === "active" && (
        <div className={styles.footerCta}>
          <Link href="/make-selection" className="lms-btn lms-btn--primary">
            Make your Week {game.gameWeek} pick
          </Link>
        </div>
      )}
    </main>
  );
}
