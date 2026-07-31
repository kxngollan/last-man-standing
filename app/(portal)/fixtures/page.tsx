"use client";

import { useCallback, useEffect, useState } from "react";
import { TeamCrest } from "@/components/portal/TeamCrest";
import type { FixturesWeek, FixtureRow } from "@/lib/game/portalTypes";
import styles from "./page.module.css";

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.main}>
      <div className="lms-state">{children}</div>
    </main>
  );
}

function kickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function dateKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Group fixtures by their local calendar date, preserving kickoff order. */
function groupByDate(fixtures: FixtureRow[]): { date: string; games: FixtureRow[] }[] {
  const groups: { date: string; games: FixtureRow[] }[] = [];
  for (const f of fixtures) {
    const date = dateKey(f.kickoff);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.games.push(f);
    else groups.push({ date, games: [f] });
  }
  return groups;
}

function Scoreline({ f }: { f: FixtureRow }) {
  const played = f.state === "finished" || f.state === "live";
  if (played && f.homeScore != null && f.awayScore != null) {
    return (
      <span className={styles.center}>
        <span className={styles.score} data-nums>
          {f.homeScore}
          <span className={styles.dash}>–</span>
          {f.awayScore}
        </span>
        <span
          className={`${styles.state} ${f.state === "live" ? styles.live : ""}`}
          data-nums
        >
          {f.statusLabel}
        </span>
      </span>
    );
  }
  if (f.state === "postponed") {
    return (
      <span className={styles.center}>
        <span className={styles.vs}>vs</span>
        <span className={styles.state}>Postponed</span>
      </span>
    );
  }
  return (
    <span className={styles.center}>
      <span className={styles.time} data-nums>
        {kickoffTime(f.kickoff)}
      </span>
      <span className={styles.vs}>KO</span>
    </span>
  );
}

export default function FixturesPage() {
  const [week, setWeek] = useState<FixturesWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (matchday: number | null) => {
    setLoading(true);
    try {
      const q = matchday ? `?matchday=${matchday}` : "";
      const res = await fetch(`/api/fixtures${q}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setWeek((await res.json()) as FixturesWeek);
      setError(null);
    } catch {
      setError("We couldn’t load the fixtures. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  if (loading && !week) {
    return (
      <StateShell>
        <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
        <p className="lms-state__body">Loading the fixtures…</p>
      </StateShell>
    );
  }
  if (error && !week) {
    return (
      <StateShell>
        <h1 className="lms-state__title">Something went wrong</h1>
        <p className="lms-state__body">{error}</p>
        <button className="lms-btn lms-btn--primary" onClick={() => load(null)}>
          Retry
        </button>
      </StateShell>
    );
  }
  if (!week) return null;

  const { matchday, currentMatchday, totalMatchdays, season, fixtures } = week;
  const seasonLabel = `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
  const groups = groupByDate(fixtures);

  return (
    <main className={styles.main}>
      <div className="lms-head">
        <p className={styles.kicker} data-nums>
          Premier League &middot; {seasonLabel}
        </p>
        <h1 className={styles.title}>Fixtures</h1>
        <p className="lms-head__hint">
          Browse every game week. Check who plays who before you lock in your pick.
        </p>
      </div>

      <div className={styles.controls}>
        <button
          className="lms-btn lms-btn--ghost lms-btn--sm"
          onClick={() => load(matchday - 1)}
          disabled={loading || matchday <= 1}
          aria-label="Previous game week"
        >
          ‹ Prev
        </button>

        <label className={styles.weekPick}>
          <span className={styles.weekLabel}>
            Game week
            {matchday === currentMatchday && <span className={styles.nowTag}>now</span>}
          </span>
          <select
            className={styles.weekSelect}
            value={matchday}
            onChange={(e) => load(Number(e.target.value))}
            disabled={loading}
            data-nums
          >
            {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Week {n}
                {n === currentMatchday ? " (now)" : ""}
              </option>
            ))}
          </select>
        </label>

        <button
          className="lms-btn lms-btn--ghost lms-btn--sm"
          onClick={() => load(matchday + 1)}
          disabled={loading || matchday >= totalMatchdays}
          aria-label="Next game week"
        >
          Next ›
        </button>
      </div>

      {fixtures.length === 0 ? (
        <p className={styles.notice}>No fixtures scheduled for this game week yet.</p>
      ) : (
        <div className={styles.weeks} aria-busy={loading}>
          {groups.map((g) => (
            <section key={g.date} className={styles.day}>
              <h2 className={styles.dayTitle}>{g.date}</h2>
              <ul className={styles.games}>
                {g.games.map((f) => (
                  <li key={f.apiId} className={styles.game} data-state={f.state}>
                    <span className={`${styles.team} ${styles.homeTeam}`}>
                      <span
                        className={styles.teamName}
                        data-win={f.winner === "HOME_TEAM"}
                      >
                        {f.home.shortName || f.home.name}
                      </span>
                      <TeamCrest crest={f.home.crest} tla={f.home.tla} />
                    </span>

                    <Scoreline f={f} />

                    <span className={`${styles.team} ${styles.awayTeam}`}>
                      <TeamCrest crest={f.away.crest} tla={f.away.tla} />
                      <span
                        className={styles.teamName}
                        data-win={f.winner === "AWAY_TEAM"}
                      >
                        {f.away.shortName || f.away.name}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
