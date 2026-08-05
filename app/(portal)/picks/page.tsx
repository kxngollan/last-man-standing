"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TeamCrest } from "@/components/portal/TeamCrest";
import type { PickSummary } from "@/lib/game/portalTypes";
import styles from "./page.module.css";

export default function PicksPage() {
  const [summary, setSummary] = useState<PickSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/picks/summary", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to load.");
      setSummary(body as PickSummary);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className={styles.main}>
        <div className="lms-state">
          <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
          <p className="lms-state__body">Counting the picks…</p>
        </div>
      </main>
    );
  }

  if (error || !summary) {
    return (
      <main className={styles.main}>
        <div className="lms-state">
          <h1 className="lms-state__title">Couldn&rsquo;t load the picks</h1>
          <p className="lms-state__body">{error ?? "Please try again."}</p>
          <button className="lms-btn lms-btn--primary" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  const max = summary.teams[0]?.count ?? 1;

  return (
    <main className={styles.main}>
      <Link href="/dashboard" className={styles.back}>
        &lsaquo; Back to standings
      </Link>

      <div className="lms-head">
        <p className={styles.kicker} data-nums>
          Game week {summary.gameWeek}
        </p>
        <h1 className={styles.title}>This week&rsquo;s picks</h1>
        <p className="lms-head__hint">
          {summary.totalPicks === 0
            ? "Nobody has picked yet — be the first."
            : `Where all ${summary.totalPicks} ${
                summary.totalPicks === 1 ? "pick" : "picks"
              } have gone so far. One team each, no repeats.`}
        </p>
      </div>

      {summary.teams.length > 0 && (
        <ol className={styles.list}>
          {summary.teams.map((t, i) => (
            <li key={t.teamApiId} className={styles.row}>
              <span className={styles.pos} data-nums aria-hidden="true">
                {i + 1}
              </span>
              <TeamCrest crest={t.crest} tla={t.tla} />
              <span className={styles.name}>{t.shortName || t.name}</span>
              <span className={styles.bar} aria-hidden="true">
                <span
                  className={styles.fill}
                  style={{ width: `${Math.max(6, (t.count / max) * 100)}%` }}
                />
              </span>
              <span className={styles.count} data-nums>
                {t.count}
                <span className={styles.share}>
                  {summary.totalPicks > 0
                    ? ` · ${Math.round((t.count / summary.totalPicks) * 100)}%`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
