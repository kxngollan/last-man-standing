import type { ReactNode } from "react";
import Link from "next/link";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { PickTimeline } from "@/components/portal/PickTimeline";
import { TrophyArt } from "@/components/ui/FootballArt";
import { monthYear, seasonLabel } from "@/lib/format";
import { TEAMS_PER_GAME } from "@/lib/game/constants";
import type {
  HeadToHead,
  ProfileGame,
  ProfileTeamTally,
  UserProfile,
} from "@/lib/game/portalTypes";
import ShareLink from "./ShareLink";
import styles from "./profile.module.css";

/** How a game went for this player, in a chip. */
function outcomeOf(g: ProfileGame): { label: string; chip: string } {
  if (g.entryStatus === "winner") return { label: "Won it", chip: "lms-chip--safe" };
  if (g.entryStatus === "alive") return { label: "Still in", chip: "lms-chip--safe" };
  return { label: `Out in Week ${g.eliminatedGameWeek ?? "—"}`, chip: "lms-chip--out" };
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className={styles.stat}>
      <div className="lms-stat__num" data-nums>
        {value}
      </div>
      <div className="lms-stat__label">{label}</div>
    </div>
  );
}

function TeamTally({ team }: { team: ProfileTeamTally }) {
  return (
    <span className={styles.tally}>
      <TeamCrest crest={team.crest} tla={team.tla} />
      <span className={styles.tallyName}>{team.name}</span>
      <span className={styles.tallyCount} data-nums>
        &times;{team.count}
      </span>
    </span>
  );
}

/** The meta line every game card carries. */
function GameMeta({ g }: { g: ProfileGame }) {
  return (
    <p className={styles.gameMeta} data-nums>
      {seasonLabel(g.season)} &middot; {g.survivedWeeks}{" "}
      {g.survivedWeeks === 1 ? "week" : "weeks"} survived &middot; {g.rank}
      {ordinal(g.rank)} of {g.playersTotal} &middot; {g.teamsUsed} of {TEAMS_PER_GAME} teams used
    </p>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

function h2hLine(h: HeadToHead, name: string): string {
  const games = `${h.gamesShared} ${h.gamesShared === 1 ? "game" : "games"}`;
  if (h.viewerAhead > h.profileAhead) {
    return `You've outlasted ${name} in ${h.viewerAhead} of ${games}.`;
  }
  if (h.profileAhead > h.viewerAhead) {
    return `${name} has outlasted you in ${h.profileAhead} of ${games}.`;
  }
  return h.viewerAhead > 0
    ? `Honours even across ${games} — ${h.viewerAhead} apiece.`
    : `Level across ${games}: you've always gone out together.`;
}

export function ProfileView({ profile }: { profile: UserProfile }) {
  const { isSelf, name, stats, current, past } = profile;
  const hasPlayed = stats.gamesPlayed > 0;

  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {profile.initials}
          </span>
          <div>
            <p className={styles.kicker}>Member since {monthYear(profile.memberSince)}</p>
            <h1 className={styles.title}>{name}</h1>
            {current && (
              <p className={styles.sub}>
                <span className={`lms-chip ${outcomeOf(current).chip}`}>
                  <span className="lms-dot" aria-hidden="true" />
                  {outcomeOf(current).label}
                </span>
                <span data-nums>Game {current.no}</span>
              </p>
            )}
          </div>
        </div>
        <div className={styles.headActions}>
          {/* Always the by-id URL: /profile only ever shows the viewer their own. */}
          <ShareLink path={`/profile/${profile.id}`} />
          {isSelf && (
            <Link href="/setting" className={styles.settingsLink}>
              Settings
            </Link>
          )}
        </div>
      </header>

      {!hasPlayed ? (
        <section className={styles.empty}>
          <p className={styles.emptyBody}>
            {isSelf
              ? "You haven’t joined a game yet. Your record starts with your first pick."
              : `${name} hasn’t played a game yet.`}
          </p>
          {isSelf && (
            <Link href="/dashboard" className="lms-btn lms-btn--primary">
              Go to dashboard
            </Link>
          )}
        </section>
      ) : (
        <>
          <section className={styles.stats} aria-label="Career at a glance">
            <Stat value={stats.gamesPlayed} label={stats.gamesPlayed === 1 ? "game" : "games"} />
            <Stat value={stats.wins} label={stats.wins === 1 ? "win" : "wins"} />
            <Stat value={stats.bestRun} label="best run, in weeks" />
            <Stat value={stats.totalWeeksSurvived} label="weeks survived all-time" />
          </section>

          {current && (
            <section className={styles.block} aria-label="This game">
              <div className="lms-head">
                <h2 className="lms-head__title">
                  <span data-nums>Game {current.no}</span>
                </h2>
                <GameMeta g={current} />
              </div>
              {current.picks.length === 0 ? (
                <p className={styles.notice}>No picks yet this game.</p>
              ) : (
                <PickTimeline picks={current.picks} />
              )}
            </section>
          )}

          {past.length > 0 && (
            <section className={styles.block} aria-label="Past games">
              <div className="lms-head">
                <h2 className="lms-head__title">Past games</h2>
                <p className="lms-head__hint">Open a game to see the picks behind the run.</p>
              </div>
              <ul className={styles.games}>
                {past.map((g) => {
                  const outcome = outcomeOf(g);
                  return (
                    <li key={`${g.no}-${g.season}`}>
                      <details className={styles.game}>
                        <summary className={styles.gameSummary}>
                          <span className={styles.gameNo} data-nums>
                            Game {g.no}
                          </span>
                          <GameMeta g={g} />
                          <span className={`lms-chip ${outcome.chip}`}>{outcome.label}</span>
                        </summary>
                        {g.picks.length === 0 ? (
                          <p className={styles.notice}>No picks were made.</p>
                        ) : (
                          <PickTimeline picks={g.picks} />
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className={styles.block} aria-label="Record">
            <div className="lms-head">
              <h2 className="lms-head__title">Record</h2>
              <p className="lms-head__hint">
                Counted from picks that have been played. Weeks still to come aren’t included.
              </p>
            </div>
            <dl className={styles.record}>
              <div className={styles.recordItem}>
                <dt className={styles.recordKey}>Picks made</dt>
                <dd className={styles.recordVal} data-nums>
                  {stats.picksMade}
                </dd>
              </div>
              <div className={styles.recordItem}>
                <dt className={styles.recordKey}>Won / drew / lost</dt>
                <dd className={styles.recordVal} data-nums>
                  {stats.won}–{stats.drawn}–{stats.lost}
                </dd>
              </div>
              <div className={styles.recordItem}>
                <dt className={styles.recordKey}>Pick win rate</dt>
                <dd className={styles.recordVal} data-nums>
                  {stats.winRate == null ? "—" : `${stats.winRate}%`}
                </dd>
              </div>
              <div className={styles.recordItem}>
                <dt className={styles.recordKey}>Average run</dt>
                <dd className={styles.recordVal} data-nums>
                  {stats.averageWeeks} {stats.averageWeeks === 1 ? "week" : "weeks"}
                </dd>
              </div>
              <div className={styles.recordItem}>
                <dt className={styles.recordKey}>Wildcards played</dt>
                <dd className={styles.recordVal} data-nums>
                  {stats.wildcardsPlayed}
                </dd>
              </div>
              <div className={styles.recordItem}>
                <dt className={styles.recordKey}>Deadlines missed</dt>
                <dd className={styles.recordVal} data-nums>
                  {stats.autoPicks}
                </dd>
              </div>
              <div className={styles.recordItem}>
                <dt className={styles.recordKey}>Goes back to</dt>
                <dd className={styles.recordVal}>
                  {stats.favouriteTeam ? <TeamTally team={stats.favouriteTeam} /> : "—"}
                </dd>
              </div>
              <div className={styles.recordItem}>
                <dt className={styles.recordKey}>Undone by</dt>
                <dd className={styles.recordVal}>
                  {stats.nemesisTeam ? <TeamTally team={stats.nemesisTeam} /> : "—"}
                </dd>
              </div>
            </dl>
          </section>

          {profile.headToHead && (
            <section className={`lms-panel ${styles.h2h}`} aria-label="Head to head">
              <TrophyArt className={styles.h2hArt} />
              <h2 className={styles.h2hTitle}>Head to head</h2>
              <p className={styles.h2hLine}>{h2hLine(profile.headToHead, name)}</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
