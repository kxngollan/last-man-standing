import type { Metadata } from "next";
import Link from "next/link";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { WhistleArt } from "@/components/ui/FootballArt";
import { getFixturesForMatchday, getTeams } from "@/lib/game/browse";
import type { FixtureRow } from "@/lib/game/portalTypes";
import { seasonLabel, kickoffTime, longDate } from "@/lib/format";
import WeekSelect from "./WeekSelect";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Premier League Fixtures",
  description:
    "Premier League fixtures and results by game week — kickoff times, scores and postponements. Check who plays who before you lock in your pick.",
  alternates: { canonical: "/fixtures" },
  // Public page — overrides the portal layout's noindex.
  robots: { index: true, follow: true },
};

// Week state lives in the URL; results come from the cron-synced fixtures.
export const dynamic = "force-dynamic";

/** Group fixtures by their London calendar date, preserving kickoff order. */
function groupByDate(fixtures: FixtureRow[]): { date: string; games: FixtureRow[] }[] {
  const groups: { date: string; games: FixtureRow[] }[] = [];
  for (const f of fixtures) {
    const date = longDate(f.kickoff);
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
        <span className={`${styles.state} ${f.state === "live" ? styles.live : ""}`} data-nums>
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

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ matchday?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.matchday);
  const [week, teams] = await Promise.all([
    getFixturesForMatchday(Number.isInteger(requested) ? requested : undefined),
    getTeams(),
  ]);

  const { matchday, currentMatchday, totalMatchdays, season, fixtures } = week;
  const groups = groupByDate(fixtures);

  return (
    <main className={styles.main}>
      <div className={`lms-head ${styles.headWithArt}`}>
        <WhistleArt className={styles.headArt} />
        <p className={styles.kicker} data-nums>
          Premier League &middot; {seasonLabel(season)}
        </p>
        <h1 className={styles.title}>Fixtures</h1>
        <p className="lms-head__hint">
          Browse every game week. Check who plays who before you lock in your pick.
        </p>
      </div>

      <div className={styles.controls}>
        {matchday <= 1 ? (
          <span className="lms-btn lms-btn--ghost lms-btn--sm" aria-disabled="true">
            ‹ Prev
          </span>
        ) : (
          <Link
            href={`/fixtures?matchday=${matchday - 1}`}
            className="lms-btn lms-btn--ghost lms-btn--sm"
            aria-label="Previous game week"
          >
            ‹ Prev
          </Link>
        )}

        <WeekSelect
          matchday={matchday}
          currentMatchday={currentMatchday}
          totalMatchdays={totalMatchdays}
        />

        {matchday >= totalMatchdays ? (
          <span className="lms-btn lms-btn--ghost lms-btn--sm" aria-disabled="true">
            Next ›
          </span>
        ) : (
          <Link
            href={`/fixtures?matchday=${matchday + 1}`}
            className="lms-btn lms-btn--ghost lms-btn--sm"
            aria-label="Next game week"
          >
            Next ›
          </Link>
        )}
      </div>

      {teams.length > 0 && (
        <nav className={styles.teamsNav} aria-label="Fixtures by team">
          <p className={styles.teamsLabel}>Or follow one club</p>
          <div className={styles.teamsRow}>
            {teams.map((t) => (
              <Link
                key={t.tla}
                href={`/fixtures/${t.tla}`}
                className={styles.teamBtn}
                title={`${t.name} fixtures`}
              >
                <TeamCrest crest={t.crest} tla={t.tla} />
                <span className={styles.teamBtnTla} data-nums>
                  {t.tla}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      )}

      {fixtures.length === 0 ? (
        <p className={styles.notice}>No fixtures scheduled for this game week yet.</p>
      ) : (
        <div className={styles.weeks}>
          {groups.map((g) => (
            <section key={g.date} className={styles.day}>
              <h2 className={styles.dayTitle}>{g.date}</h2>
              <ul className={styles.games}>
                {g.games.map((f) => (
                  <li key={f.apiId} className={styles.game} data-state={f.state}>
                    <span className={`${styles.team} ${styles.homeTeam}`}>
                      <span className={styles.teamName} data-win={f.winner === "HOME_TEAM"}>
                        {f.home.shortName || f.home.name}
                      </span>
                      <TeamCrest crest={f.home.crest} tla={f.home.tla} />
                    </span>

                    <Scoreline f={f} />

                    <span className={`${styles.team} ${styles.awayTeam}`}>
                      <TeamCrest crest={f.away.crest} tla={f.away.tla} />
                      <span className={styles.teamName} data-win={f.winner === "AWAY_TEAM"}>
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
