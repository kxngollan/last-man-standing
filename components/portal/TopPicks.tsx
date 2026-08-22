import Link from "next/link";
import { TeamCrest } from "./TeamCrest";
import { PickRoster } from "./PickRoster";
import { ShareMeter } from "./ShareMeter";
import { ResultMark } from "@/components/ui/ResultMark";
import { teamWeekMeta } from "@/lib/game/pickMeta";
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

/**
 * One game week's most-picked teams, with who's on each one — shared by the
 * dashboard and make-selection so players see the same live board wherever
 * they're deciding. Hook-free: renders on the server or inside an island.
 *
 * Each row is banded by how that team's week went, the way the league table
 * bands its last five: green when everyone on the team went through, red when
 * nobody did, grey when it split. A split is a draw — the players who came
 * through it are the ones who played a wildcard.
 *
 * Rows show the first few names per line and link to the team's own page for
 * the rest; nobody needs forty names on a summary board.
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
  // Teams arrive most-picked first, so the first one sets the meter's scale.
  const max = summary.teams[0]?.count ?? 1;

  return (
    <section aria-label={`Week ${summary.gameWeek} picks`}>
      <div className="lms-head">
        <h2 className="lms-head__title">Week {summary.gameWeek} picks</h2>
        <p className="lms-head__hint">{hintFor(summary)}</p>
      </div>
      <ol className={styles.list}>
        {top.map((t) => {
          const week = teamWeekMeta(t.counts, t.count, summary.state);
          const share =
            summary.totalPicks > 0 ? Math.round((t.count / summary.totalPicks) * 100) : 0;
          return (
            <li key={t.teamApiId} className={styles.row} data-tone={week.tone}>
              {/* The whole row opens the team's week — that's where the full
                  list of names lives. */}
              <Link
                href={`/picks/${summary.gameWeek}/${t.tla.toLowerCase()}`}
                className={styles.rowLink}
              >
                <TeamCrest crest={t.crest} tla={t.tla} />
                <span className={styles.meta}>
                  <span className={styles.titleLine}>
                    <span className={styles.name}>{t.shortName || t.name}</span>
                    {week.mark && (
                      <span className={styles.disc}>
                        <ResultMark kind={week.mark} size={11} label={week.detail} />
                      </span>
                    )}
                    <span className={styles.tally} data-nums>
                      {week.label}
                    </span>
                    <span className={styles.share} data-nums>
                      {t.count} &middot; {share}%
                    </span>
                    {t.wildcards > 0 && (
                      <span
                        className={styles.wcCount}
                        title={`${t.wildcards} played a wildcard on this team — a draw is enough for them`}
                      >
                        {t.wildcards} WC
                      </span>
                    )}
                  </span>
                  {showPlayers && t.roster && t.roster.length > 0 && (
                    <PickRoster roster={t.roster} counts={t.counts} perLine={3} />
                  )}
                  {showPlayers && !t.roster && t.players.length > 0 && (
                    <span className={styles.plainNames}>
                      {t.players.join(", ")}
                      {t.count > t.players.length && ` +${t.count - t.players.length}`}
                    </span>
                  )}
                </span>
                {/* How much of the week this team took, in ink so it stands
                    out against whatever colour the row is carrying. */}
                <span className={styles.meter}>
                  <ShareMeter
                    value={t.count}
                    max={max}
                    label={`${t.count} of the week’s ${summary.totalPicks} picks — ${share}%`}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {summary.totalPicks > 0 && (
        <Link href={`/picks?week=${summary.gameWeek}`} className={styles.allLink}>
          {`See who picked what in Week ${summary.gameWeek} `}&rsaquo;
        </Link>
      )}
    </section>
  );
}
