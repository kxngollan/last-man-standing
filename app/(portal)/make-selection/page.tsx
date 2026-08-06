import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StateShell } from "@/components/portal/StateShell";
import { StatusIcon } from "@/components/ui/StatusIcon";
import { getGameStateForUser, getPickSummary } from "@/lib/game/queries";
import PickForm from "./PickForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Make your pick",
};

export default async function MakeSelectionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/make-selection");

  const [state, summary] = await Promise.all([
    getGameStateForUser(session.user.id),
    // Compact board: a few names per team, "+N more" covers the rest.
    getPickSummary({ playersPerTeam: 3 }).catch(() => null),
  ]);
  const myPick = state.myPick;

  if (!state.game) {
    return (
      <StateShell className={styles.main}>
        <h1 className="lms-state__title">No game running</h1>
        <p className="lms-state__body">There’s no game to pick for right now.</p>
        <Link href="/dashboard" className="lms-btn lms-btn--ghost">
          Back to dashboard
        </Link>
      </StateShell>
    );
  }

  if (!state.entry) {
    return (
      <StateShell className={styles.main}>
        <h1 className="lms-state__title">
          {state.game.status === "registration" ? "Join to play" : "You’re not in this game"}
        </h1>
        <p className="lms-state__body">
          {state.game.status === "registration"
            ? "Registration is open. Join from the dashboard to make your first pick."
            : "This game already kicked off. You’ll be able to join the next one."}
        </p>
        <Link href="/dashboard" className="lms-btn lms-btn--primary">
          Go to dashboard
        </Link>
      </StateShell>
    );
  }

  if (state.entry.status !== "alive") {
    return (
      <StateShell className={styles.main}>
        <h1 className="lms-state__title">
          {state.entry.status === "winner" ? "You won this game 🏆" : "You’re out"}
        </h1>
        <p className="lms-state__body">
          {state.entry.status === "winner"
            ? "Last one standing. Enjoy the bragging rights."
            : "Your run ended this game. Hang tight for the next one."}
        </p>
        <Link href="/dashboard" className="lms-btn lms-btn--ghost">
          See standings
        </Link>
      </StateShell>
    );
  }

  // Legacy skip-the-week wildcard (no team attached) from the old rules.
  if (myPick?.isWildcard && myPick.teamApiId == null) {
    return (
      <StateShell className={styles.main}>
        <StatusIcon kind="wild" />
        <h1 className="lms-state__title">Wildcard played</h1>
        <p className="lms-state__body">
          You’re safe for Week {state.pickGameWeek} without using a team. See you next week.
        </p>
        <Link href="/dashboard" className="lms-btn lms-btn--ghost">
          Back to dashboard
        </Link>
      </StateShell>
    );
  }

  return (
    <PickForm
      // Remount the form whenever the confirmed pick changes, so its local
      // selection state re-syncs after a save (router.refresh()).
      key={`${state.pickMatchday}:${myPick?.teamApiId ?? "none"}:${myPick?.isWildcard ? 1 : 0}`}
      gameWeek={state.pickGameWeek}
      pickAhead={state.pickAhead}
      locked={state.locked}
      deadline={state.deadline}
      teams={state.teams}
      myPick={myPick}
      wildcardUsed={state.entry.wildcardUsed}
      survivedWeeks={state.entry.survivedWeeks}
      playersAlive={state.players.alive}
      summary={summary}
    />
  );
}
