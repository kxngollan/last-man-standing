import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StateShell } from "@/components/portal/StateShell";
import { TopPicks } from "@/components/portal/TopPicks";
import { DeadlineClock } from "@/components/portal/DeadlineClock";
import { BallArt } from "@/components/ui/FootballArt";
import { getGameStateForUser, getPickSummary } from "@/lib/game/queries";
import { Stat, JoinButton, StandingsBoard } from "./islands";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Standings",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/dashboard");

  const [state, summary] = await Promise.all([
    getGameStateForUser(session.user.id),
    // Compact board: a few names per team, "+N more" covers the rest.
    getPickSummary({ playersPerTeam: 3 }).catch(() => null),
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

      <TopPicks summary={summary} />

      <section aria-label="Standings">
        <div className="lms-head">
          <h2 className={`lms-head__title ${styles.standingsTitle}`}>
            <BallArt className={styles.standingsBall} />
            Standings
          </h2>
          <p className="lms-head__hint">
            Survive each week to climb. When one player is left, they win the game.
          </p>
        </div>

        {standingsTotal === 0 ? (
          <p className={styles.notice}>No players yet. Be the first to join.</p>
        ) : (
          <StandingsBoard firstPage={standings} myStanding={myStanding} total={standingsTotal} />
        )}
      </section>
    </main>
  );
}
