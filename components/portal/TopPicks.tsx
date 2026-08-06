import Link from "next/link";
import { TeamCrest } from "./TeamCrest";
import type { PickSummary } from "@/lib/game/portalTypes";
import styles from "./TopPicks.module.css";

/**
 * The open week's most-picked teams, with who's on each one — shared by the
 * dashboard and make-selection so players see the same live board wherever
 * they're deciding. Hook-free: renders on the server or inside an island.
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
  if (!summary || summary.totalPicks === 0) return null;
  const top = summary.teams.slice(0, limit);
  const max = top[0]?.count ?? 1;

  return (
    <section aria-label="Most picked teams">
      <div className="lms-head">
        <h2 className="lms-head__title">Week {summary.gameWeek} picks</h2>
        <p className="lms-head__hint">
          What the field is backing this week — {summary.totalPicks}{" "}
          {summary.totalPicks === 1 ? "pick" : "picks"} in so far. Everyone sees this board.
        </p>
      </div>
      <ol className={styles.list}>
        {top.map((t) => (
          <li key={t.teamApiId} className={styles.row}>
            <TeamCrest crest={t.crest} tla={t.tla} />
            <span className={styles.meta}>
              <span className={styles.name}>{t.shortName || t.name}</span>
              {showPlayers && t.players.length > 0 && (
                <span className={styles.players}>
                  {t.players.join(", ")}
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
      <Link href="/picks" className={styles.allLink}>
        {`See who picked what in Week ${summary.gameWeek} `}&rsaquo;
      </Link>
    </section>
  );
}
