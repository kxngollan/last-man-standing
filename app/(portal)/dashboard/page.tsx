import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StateShell } from "@/components/portal/StateShell";
import { TopPicks } from "@/components/portal/TopPicks";
import { WeekBar } from "@/components/portal/WeekBar";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { DeadlineClock } from "@/components/portal/DeadlineClock";
import { BallArt } from "@/components/ui/FootballArt";
import { getGameStateForUser, getPickSummary, getWeekOptions } from "@/lib/game/queries";
import { dateTimeLabel } from "@/lib/format";
import { Stat, JoinButton, StandingsBoard } from "./islands";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Standings",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/dashboard");

  // One game week is on screen at a time, and it lives in the URL: the week
  // buttons move between weeks, and both the picks board and the standings
  // read the same one. Default is the week being played.
  const asked = Number((await searchParams).week);
  const weeks = await getWeekOptions();
  const inPlayWeek = weeks.find((w) => w.state === "in-play")?.gameWeek ?? 1;
  const week =
    Number.isInteger(asked) && weeks.some((w) => w.gameWeek === asked) ? asked : inPlayWeek;

  const [state, summary] = await Promise.all([
    getGameStateForUser(session.user.id, { standingsWeek: week }),
    // Compact board: a few names per team, "+N more" covers the rest.
    getPickSummary({ gameWeek: week, playersPerTeam: 3, withState: true }).catch(() => null),
  ]);

  if (!state.game) {
    return (
      <StateShell className={styles.main}>
        <BallArt className={styles.stateBall} />
        <h1 className="lms-state__title">No game running</h1>
        <p className="lms-state__body">
          There isn’t a game on right now. Check back soon. A new one starts when the admin
          opens registration.
        </p>
      </StateShell>
    );
  }

  const { game, entry, players, myPick, myStanding, pickGameWeek, standings, standingsTotal } =
    state;
  const wildcardsLeft = entry ? (entry.wildcardUsed ? 0 : 1) : 0;

  // Where the player stands in the week being played, before the resolver has
  // had its say. "Safe" and "out" are read off finished fixtures, so they are
  // already certain — the resolution just writes them down.
  const live = state.liveWeek;
  const liveChip =
    live?.state === "safe"
      ? { cls: "lms-chip--safe", label: `Safe · Week ${live.gameWeek}` }
      : live?.state === "out"
        ? { cls: "lms-chip--out", label: `Out · Week ${live.gameWeek}` }
        : { cls: "lms-chip--neutral", label: `Week ${live?.gameWeek ?? ""} in play` };

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
        {!entry && game.status === "registration" && <JoinButton />}
        {/* Same clock as make-selection — everyone sees when picks lock. */}
        {game.status !== "finished" && (
          <DeadlineClock deadline={state.deadline} locked={state.locked} />
        )}
      </div>

      {/* Only once the week has locked and is being played — before that the
          deadline clock and the pick stat already say everything there is. */}
      {entry?.status === "alive" && live && game.status === "active" && (state.pickAhead || state.locked) && (
        <section
          className={styles.live}
          data-state={live.state}
          aria-label={`Your week ${live.gameWeek} status`}
        >
          <span className={`lms-chip ${liveChip.cls}`}>
            <span className="lms-dot" aria-hidden="true" />
            {liveChip.label}
          </span>
          {live.tla && <TeamCrest crest={live.crest} tla={live.tla} />}
          <p className={styles.liveDetail}>
            {live.detail}
            {live.state !== "pending" && (
              <span className={styles.liveNote}> Official once the week is processed.</span>
            )}
          </p>
          <span className={styles.liveWhen} data-nums>
            {live.kickoff ? dateTimeLabel(live.kickoff) : live.score ? live.score : ""}
          </span>
        </section>
      )}

      {entry && (
        <section className={styles.stats} aria-label="Your game at a glance">
          <Stat value={players.alive} label={`of ${players.total} still standing`} />
          <Stat value={entry.survivedWeeks} label="weeks survived" />
          <Stat value={wildcardsLeft} label="wildcard left" />
          <div className={styles.stat}>
            <div className={styles.pickNum}>
              {myPick?.teamName
                ? `${myPick.teamName}${myPick.isWildcard ? " ★" : ""}`
                : myPick?.isWildcard
                  ? "Wildcard"
                  : "Not set"}
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

      {/* One control for the week, and everything under it follows: the picks
          board first, then the standings' pick column. */}
      <WeekBar weeks={weeks} selected={week} href={(w) => `/dashboard?week=${w}`} />

      <TopPicks summary={summary} />

      <section aria-label="Standings">
        <div className="lms-head">
          <h2 className={`lms-head__title ${styles.standingsTitle}`}>
            <BallArt className={styles.standingsBall} />
            Standings
          </h2>
          <p className="lms-head__hint">
            Survive each week to climb. When one player is left, they win the game. Teams shown are
            each player&rsquo;s Week {week} pick.
          </p>
        </div>

        {standingsTotal === 0 ? (
          <p className={styles.notice}>No players yet. Be the first to join.</p>
        ) : (
          <StandingsBoard
            key={week}
            firstPage={standings}
            myStanding={myStanding}
            total={standingsTotal}
            week={week}
          />
        )}
      </section>
    </main>
  );
}
