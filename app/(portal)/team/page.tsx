import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { StateShell } from "@/components/portal/StateShell";
import { CornerFlagArt } from "@/components/ui/FootballArt";
import { getGameStateForUser } from "@/lib/game/queries";
import { TEAMS_PER_GAME } from "@/lib/game/constants";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "My picks",
};

const RESULT_META: Record<string, { chip: string; label: string; detail: string }> = {
  win: { chip: "lms-chip--safe", label: "Won", detail: "Won. Through to the next week." },
  safe: { chip: "lms-chip--safe", label: "Safe", detail: "Safe this week." },
  postponed: { chip: "lms-chip--safe", label: "Safe", detail: "Match postponed, counted as safe." },
  draw: { chip: "lms-chip--out", label: "Out", detail: "Drew. Knocked out here." },
  loss: { chip: "lms-chip--out", label: "Out", detail: "Lost. Knocked out here." },
  pending: { chip: "lms-chip--neutral", label: "This week", detail: "Awaiting this week’s result." },
};

/** Wildcard weeks read differently: a draw is a save, not an exit. */
function wildcardMeta(p: { tla: string | null; result: string }) {
  if (!p.tla) {
    // Legacy teamless wildcard (skip-the-week rules).
    return { chip: "lms-chip--wild", label: "Wildcard", detail: "Wildcard played. Safe this week." };
  }
  switch (p.result) {
    case "pending":
      return {
        chip: "lms-chip--wild",
        label: "Wildcard on",
        detail: "Wildcard played — win or draw and you’re through.",
      };
    case "draw":
      return {
        chip: "lms-chip--wild",
        label: "Wildcard save",
        detail: "Drew — the wildcard kept you in.",
      };
    case "win":
      return { chip: "lms-chip--safe", label: "Won", detail: "Won — the wildcard wasn’t needed." };
    default:
      return RESULT_META[p.result] ?? RESULT_META.pending;
  }
}

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
        <ol className={styles.timeline}>
          {history.map((p) => {
            const meta = p.isWildcard ? wildcardMeta(p) : RESULT_META[p.result] ?? RESULT_META.pending;
            return (
              <li key={p.matchday} className={styles.entry} data-pending={p.result === "pending"}>
                <div className={styles.marker} aria-hidden="true">
                  <span className={styles.gw} data-nums>
                    GW{p.gameWeek}
                  </span>
                </div>
                <div className={`lms-panel ${styles.card}`}>
                  <TeamCrest
                    crest={p.crest}
                    tla={p.tla ?? (p.isWildcard ? "WC" : null)}
                    size="lg"
                  />
                  <div className={styles.body}>
                    <div className={styles.teamLine}>
                      <span className={styles.team}>
                        {p.teamName ?? (p.isWildcard ? "Wildcard" : "—")}
                      </span>
                    </div>
                    <p className={styles.detail}>{meta.detail}</p>
                  </div>
                  <span className={`lms-chip ${meta.chip}`}>{meta.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
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
