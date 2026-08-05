"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TeamCrest } from "@/components/portal/TeamCrest";
import type { TeamFixtures, FixtureRow } from "@/lib/game/portalTypes";
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

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** The game's outcome from this club's point of view. */
function resultFor(f: FixtureRow, tla: string): "W" | "D" | "L" | null {
  if (f.state !== "finished" || !f.winner) return null;
  if (f.winner === "DRAW") return "D";
  const isHome = f.home.tla === tla;
  return (f.winner === "HOME_TEAM") === isHome ? "W" : "L";
}

const RESULT_CHIP: Record<"W" | "D" | "L", { label: string; cls: string }> = {
  W: { label: "Won", cls: "lms-chip--safe" },
  D: { label: "Drew", cls: "lms-chip--neutral" },
  L: { label: "Lost", cls: "lms-chip--out" },
};

function Centre({ f }: { f: FixtureRow }) {
  const played = f.state === "finished" || f.state === "live";
  if (played && f.homeScore != null && f.awayScore != null) {
    return (
      <span className={styles.centre}>
        <span className={styles.score} data-nums>
          {f.homeScore}
          <span className={styles.dash}>–</span>
          {f.awayScore}
        </span>
        <span className={`${styles.tag} ${f.state === "live" ? styles.liveTag : ""}`} data-nums>
          {f.statusLabel}
        </span>
      </span>
    );
  }
  if (f.state === "postponed") {
    return (
      <span className={styles.centre}>
        <span className={styles.vs}>vs</span>
        <span className={styles.tag}>Postponed</span>
      </span>
    );
  }
  return (
    <span className={styles.centre}>
      <span className={styles.time} data-nums>
        {kickoffTime(f.kickoff)}
      </span>
      <span className={styles.vs}>KO</span>
    </span>
  );
}

function Sides({ f, tla, big }: { f: FixtureRow; tla: string; big?: boolean }) {
  return (
    <div className={`${styles.match} ${big ? styles.matchBig : ""}`}>
      <span className={`${styles.side} ${styles.homeSide}`}>
        <span className={styles.sideName} data-me={f.home.tla === tla}>
          {f.home.shortName || f.home.name}
        </span>
        <TeamCrest crest={f.home.crest} tla={f.home.tla} size={big ? "lg" : "sm"} />
      </span>
      <Centre f={f} />
      <span className={`${styles.side} ${styles.awaySide}`}>
        <TeamCrest crest={f.away.crest} tla={f.away.tla} size={big ? "lg" : "sm"} />
        <span className={styles.sideName} data-me={f.away.tla === tla}>
          {f.away.shortName || f.away.name}
        </span>
      </span>
    </div>
  );
}

function MatchRow({ f, tla }: { f: FixtureRow; tla: string }) {
  const result = resultFor(f, tla);
  return (
    <li className={styles.row} data-state={f.state}>
      <p className={styles.rowMeta}>
        <span data-nums>
          Week {f.matchday} &middot; {shortDate(f.kickoff)}
        </span>
        {result && (
          <span className={`lms-chip ${RESULT_CHIP[result].cls} ${styles.resultChip}`}>
            {RESULT_CHIP[result].label}
          </span>
        )}
      </p>
      <Sides f={f} tla={tla} />
    </li>
  );
}

export default function TeamFixturesPage() {
  const params = useParams<{ team: string }>();
  const tla = (params.team ?? "").toUpperCase();

  const [data, setData] = useState<TeamFixtures | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"missing" | "failed" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fixtures/team/${tla}`, { cache: "no-store" });
      if (res.status === 404) {
        setError("missing");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as TeamFixtures);
      setError(null);
    } catch {
      setError("failed");
    } finally {
      setLoading(false);
    }
  }, [tla]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <StateShell>
        <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
        <p className="lms-state__body">Loading the fixtures…</p>
      </StateShell>
    );
  }
  if (error === "missing") {
    return (
      <StateShell>
        <h1 className="lms-state__title">Team not found</h1>
        <p className="lms-state__body">
          We don&rsquo;t know a club by &ldquo;{tla}&rdquo;. Pick one from the fixtures page.
        </p>
        <Link href="/fixtures" className="lms-btn lms-btn--primary">
          All fixtures
        </Link>
      </StateShell>
    );
  }
  if (error === "failed" || !data) {
    return (
      <StateShell>
        <h1 className="lms-state__title">Something went wrong</h1>
        <p className="lms-state__body">We couldn&rsquo;t load this team&rsquo;s fixtures. Please try again.</p>
        <button className="lms-btn lms-btn--primary" onClick={() => void load()}>
          Retry
        </button>
      </StateShell>
    );
  }

  const { team, next, upcoming, past, season } = data;
  const seasonLabel = `${season}/${String((season + 1) % 100).padStart(2, "0")}`;

  return (
    <main className={styles.main}>
      <Link href="/fixtures" className={styles.back}>
        &lsaquo; All fixtures
      </Link>

      <header className={styles.head}>
        <TeamCrest
          crest={team.crest}
          tla={team.tla}
          discClass={`lms-crest lms-crest--lg ${styles.headCrest}`}
        />
        <div>
          <p className={styles.kicker} data-nums>
            Premier League &middot; {seasonLabel}
          </p>
          <h1 className={styles.title}>{team.name}</h1>
        </div>
      </header>

      {next ? (
        <section className={styles.feature} aria-label="Next fixture" data-state={next.state}>
          <p className={styles.featureMeta}>
            <span className={`${styles.featureTag} ${next.state === "live" ? styles.liveTag : ""}`}>
              {next.state === "live" ? "Live now" : "Up next"}
            </span>
            <span data-nums>
              Week {next.matchday} &middot; {longDate(next.kickoff)}
            </span>
          </p>
          <Sides f={next} tla={team.tla} big />
        </section>
      ) : (
        <p className={styles.notice}>No games left to play this season.</p>
      )}

      {upcoming.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockTitle}>Upcoming</h2>
          <ul className={styles.rows}>
            {upcoming.map((f) => (
              <MatchRow key={f.apiId} f={f} tla={team.tla} />
            ))}
          </ul>
        </section>
      )}

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Results</h2>
        {past.length === 0 ? (
          <p className={styles.notice}>No results yet — the season hasn&rsquo;t kicked off.</p>
        ) : (
          <ul className={styles.rows}>
            {past.map((f) => (
              <MatchRow key={f.apiId} f={f} tla={team.tla} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
