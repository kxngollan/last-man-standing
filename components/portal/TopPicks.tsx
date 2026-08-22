import Link from "next/link";
import { TeamCrest } from "./TeamCrest";
import type { PickSummary } from "@/lib/game/portalTypes";
import styles from "./TopPicks.module.css";

/** What the week's counts say, in one line. */
function hintFor(summary: PickSummary): string {
  const { counts, totalPicks, state, excluded } = summary;
  if (totalPicks === 0) {
    return state === "open"
      ? "Nobody has picked for this week yet."
      : "Nobody picked this week.";
  }
  const picks = `${totalPicks} ${totalPicks === 1 ? "pick" : "picks"}`;
  const dropped =
    excluded > 0
      ? ` ${excluded} pick${excluded === 1 ? "" : "s"} from players already out ${
          excluded === 1 ? "isn’t" : "aren’t"
        } shown.`
      : "";

  if (state !== "open") {
    // The fixtures have decided some (in play) or all (already played) of these.
    const settled = [
      counts.safe > 0 ? `${counts.safe} through` : null,
      counts.out > 0 ? `${counts.out} out` : null,
      counts.pending > 0 ? `${counts.pending} still to play` : null,
    ].filter(Boolean);
    const lead = state === "played" ? "A week already played" : "The week being played";
    return `${lead} — ${picks} on it. ${settled.join(" · ")}.${dropped}`;
  }
  return counts.pending > 0
    ? `Open for picks — ${picks} in. ${counts.safe} already through to this week, ${counts.pending} still playing for a place.${dropped}`
    : `Open for picks — ${picks} in, from players already through to this week.${dropped}`;
}

const STATE_MARK: Record<string, string> = { safe: "✓", out: "✕", pending: "" };

/**
 * One game week's most-picked teams, with who's on each one — shared by the
 * dashboard and make-selection so players see the same live board wherever
 * they're deciding. Hook-free: renders on the server or inside an island.
 *
 * A board is always exactly one week (see getPickSummary), and every player on
 * it can still be in that week. Where the summary carries per-player state,
 * names show it: who is already through, and who is still playing for it.
 */
export function TopPicks({
  summary,
  limit = 3,
  showPlayers = true,
}: {
  summary: PickSummary | null;
  limit?: number;
  showPlayers?: boolean;
}) {
  if (!summary) return null;
  const top = summary.teams.slice(0, limit);
  const max = top[0]?.count ?? 1;

  return (
    <section aria-label={`Week ${summary.gameWeek} picks`}>
      <div className="lms-head">
        <h2 className="lms-head__title">Week {summary.gameWeek} picks</h2>
        <p className="lms-head__hint">{hintFor(summary)}</p>
      </div>
      <ol className={styles.list}>
        {top.map((t) => (
          <li key={t.teamApiId} className={styles.row}>
            <TeamCrest crest={t.crest} tla={t.tla} />
            <span className={styles.meta}>
              <span className={styles.name}>{t.shortName || t.name}</span>
              {showPlayers && t.players.length > 0 && (
                <span className={styles.players}>
                  {t.roster
                    ? t.roster.map((p, i) => (
                        <span key={`${p.name}-${i}`} className={styles.player} data-state={p.state}>
                          {p.name}
                          {STATE_MARK[p.state] && (
                            <span className={styles.mark} aria-hidden="true">
                              {STATE_MARK[p.state]}
                            </span>
                          )}
                          {i < t.roster!.length - 1 ? ", " : ""}
                        </span>
                      ))
                    : t.players.join(", ")}
                  {/* players is server-capped; count is the real total */}
                  {t.count > t.players.length && ` +${t.count - t.players.length} more`}
                </span>
              )}
            </span>
            <span className={styles.bar} aria-hidden="true">
              <span
                className={styles.fill}
                style={{ width: `${Math.max(8, (t.count / max) * 100)}%` }}
              />
            </span>
            <span className={styles.count} data-nums>
              {t.count}
            </span>
          </li>
        ))}
      </ol>
      {summary.totalPicks > 0 && (
        <Link href={`/picks?week=${summary.gameWeek}`} className={styles.allLink}>
          {`See who picked what in Week ${summary.gameWeek} `}&rsaquo;
        </Link>
      )}
    </section>
  );
}
