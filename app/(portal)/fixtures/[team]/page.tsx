import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { getFixturesForTeam } from "@/lib/game/browse";
import type { FixtureRow } from "@/lib/game/portalTypes";
import { seasonLabel, kickoffTime, shortDate, longDate } from "@/lib/format";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}): Promise<Metadata> {
  const { team } = await params;
  const tla = team.toUpperCase();
  return {
    title: `${tla} Fixtures & Results`,
    alternates: { canonical: `/fixtures/${tla}` },
    // Public club pages — override the portal layout's noindex.
    robots: { index: true, follow: true },
  };
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

export default async function TeamFixturesPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: teamParam } = await params;
  const data = await getFixturesForTeam(teamParam);
  if (!data) notFound();

  const { team, next, upcoming, past, season } = data;

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
            Premier League &middot; {seasonLabel(season)}
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
