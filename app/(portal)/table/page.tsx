"use client";

import { useEffect, useState } from "react";
import { TeamCrest } from "@/components/portal/TeamCrest";
import type { LeagueTable, LeagueRow } from "@/lib/game/portalTypes";
import styles from "./page.module.css";

function zoneOf(position: number, total: number): "ucl" | "uel" | "drop" | undefined {
  if (position <= 4) return "ucl";
  if (position === 5) return "uel";
  if (position > total - 3) return "drop";
  return undefined;
}

function Form({ form }: { form: string | null }) {
  if (!form) return null;
  const results = form.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(-5);
  return (
    <span className={styles.form} aria-label={`Recent form: ${results.join(" ")}`}>
      {results.map((r, i) => (
        <span key={i} className={styles.formDot} data-r={r} aria-hidden="true">
          {r}
        </span>
      ))}
    </span>
  );
}

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.main}>
      <div className="lms-state">{children}</div>
    </main>
  );
}

export default function TablePage() {
  const [table, setTable] = useState<LeagueTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/table", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setTable((await res.json()) as LeagueTable);
      setError(null);
    } catch {
      setError("We couldn’t load the table. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <StateShell>
        <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
        <p className="lms-state__body">Loading the table…</p>
      </StateShell>
    );
  }
  if (error || !table) {
    return (
      <StateShell>
        <h1 className="lms-state__title">Something went wrong</h1>
        <p className="lms-state__body">{error ?? "Please try again."}</p>
        <button className="lms-btn lms-btn--primary" onClick={() => load()}>
          Retry
        </button>
      </StateShell>
    );
  }

  const { rows, season } = table;
  const seasonLabel = `${season}/${String((season + 1) % 100).padStart(2, "0")}`;

  return (
    <main className={styles.main}>
      <div className="lms-head">
        <p className={styles.kicker} data-nums>
          Premier League &middot; {seasonLabel}
        </p>
        <h1 className={styles.title}>The table</h1>
        <p className="lms-head__hint">
          Live standings from the Premier League. Use it to weigh up who’s in form before you pick.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className={styles.notice}>The table isn’t available yet. Check back once the season is under way.</p>
      ) : (
        <div className={styles.tableWrap}>
          <div className={`${styles.row} ${styles.headRow}`} aria-hidden="true">
            <span className={styles.pos}>#</span>
            <span className={styles.club}>Club</span>
            <span className={styles.num}>P</span>
            <span className={`${styles.num} ${styles.wide}`}>W</span>
            <span className={`${styles.num} ${styles.wide}`}>D</span>
            <span className={`${styles.num} ${styles.wide}`}>L</span>
            <span className={styles.num}>GD</span>
            <span className={styles.pts}>Pts</span>
          </div>

          <ol className={styles.list}>
            {rows.map((r: LeagueRow) => (
              <li
                key={r.tla}
                className={styles.row}
                data-zone={zoneOf(r.position, rows.length)}
              >
                <span className={styles.pos} data-nums>
                  {r.position}
                </span>
                <span className={styles.club}>
                  <TeamCrest crest={r.crest} tla={r.tla} />
                  <span className={styles.clubName}>
                    <span className={styles.clubFull}>{r.shortName || r.name}</span>
                    <span className={styles.clubTla} data-nums aria-hidden="true">
                      {r.tla}
                    </span>
                  </span>
                  <Form form={r.form} />
                </span>
                <span className={styles.num} data-nums>
                  {r.played}
                </span>
                <span className={`${styles.num} ${styles.wide}`} data-nums>
                  {r.won}
                </span>
                <span className={`${styles.num} ${styles.wide}`} data-nums>
                  {r.drawn}
                </span>
                <span className={`${styles.num} ${styles.wide}`} data-nums>
                  {r.lost}
                </span>
                <span className={styles.num} data-nums>
                  {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                </span>
                <span className={styles.pts} data-nums>
                  {r.points}
                </span>
              </li>
            ))}
          </ol>

          <ul className={styles.legend} aria-label="Table zones">
            <li>
              <span className={styles.legendDot} data-zone="ucl" /> Champions League
            </li>
            <li>
              <span className={styles.legendDot} data-zone="uel" /> Europa League
            </li>
            <li>
              <span className={styles.legendDot} data-zone="drop" /> Relegation
            </li>
          </ul>
        </div>
      )}
    </main>
  );
}
