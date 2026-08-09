import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { PickTimeline } from "@/components/portal/PickTimeline";
import { StateShell } from "@/components/portal/StateShell";
import { CornerFlagArt } from "@/components/ui/FootballArt";
import { getGameStateForUser } from "@/lib/game/queries";
import { TEAMS_PER_GAME } from "@/lib/game/constants";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "My picks",
};

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/team");

  const state = await getGameStateForUser(session.user.id);

  if (!state.game || !state.entry) {
    return (
      <StateShell className={styles.main}>
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

  const { game, entry, history, pickGameWeek } = state;
  // Wildcard picks consume their team like any other pick; only the legacy
  // teamless wildcard rows (no tla) are excluded.
  const used = history.filter((h) => h.tla);
  const alive = entry.status === "alive";

  return (
    <main className={styles.main}>
      <div className={`lms-head ${styles.headWithArt}`}>
        <CornerFlagArt className={styles.headArt} />
        <p className={styles.kicker} data-nums>
          Game {game.no}
        </p>
        <h1 className={styles.title}>My picks</h1>
        <p className="lms-head__hint">
          Every team you pick is locked in for the game. You can’t use it again until a new game
          starts.
        </p>
      </div>

      {history.length === 0 ? (
        <p className="lms-head__hint">You haven’t made a pick yet this game.</p>
      ) : (
        <PickTimeline picks={history} />
      )}

      <section className={styles.used} aria-label="Teams used this game">
        <h2 className={styles.usedTitle}>
          Teams used{" "}
          <span className={styles.usedCount} data-nums>
            ({used.length} of {TEAMS_PER_GAME})
          </span>
        </h2>
        {used.length === 0 ? (
          <p className={styles.usedHint}>None yet. All {TEAMS_PER_GAME} teams are available.</p>
        ) : (
          <>
            <ul className={styles.usedList}>
              {used.map((p) => (
                <li key={p.matchday} className={styles.usedItem}>
                  <TeamCrest crest={p.crest} tla={p.tla} />
                  <span className={styles.usedName}>{p.teamName}</span>
                </li>
              ))}
            </ul>
            <p className={styles.usedHint}>
              {TEAMS_PER_GAME - used.length} teams still available. Choose wisely. You’ll want your
              strongest fixtures later.
            </p>
          </>
        )}
      </section>

      {alive && game.status !== "finished" && (
        <div className={styles.footerCta}>
          <Link href="/make-selection" className="lms-btn lms-btn--primary">
            Make your Week {pickGameWeek} pick
          </Link>
        </div>
      )}
    </main>
  );
}
