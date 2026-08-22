import { ResultMark, markFor } from "@/components/ui/ResultMark";
import { WildcardBadge } from "./WildcardBadge";
import type { LivePickState } from "@/lib/game/portalTypes";
import styles from "./PickRoster.module.css";

export interface RosterEntry {
  name: string;
  state: LivePickState;
  isWildcard: boolean;
}

/** Said in full wherever the badge has room to say it. */
export const WILDCARD_RULE =
  "Played their wildcard this week — if their team draws, they’re still safe.";

/** The three lines, in the order they matter. */
const GROUPS: Array<{ state: LivePickState; label: string }> = [
  { state: "safe", label: "Through" },
  { state: "out", label: "Out" },
  { state: "pending", label: "To play" },
];

/**
 * Who's on a team, grouped by how their week went: everyone through on one
 * line, everyone out on the next. A mixed list of forty names told you nothing
 * at a glance — the split is the whole point of reading it.
 *
 * Boards show the first few names per line and lean on the counts (which come
 * from the server, so they're the real totals however few names were sent);
 * `full` prints the lot, for the one page that's about a single team.
 */
export function PickRoster({
  roster,
  counts,
  perLine = 3,
  full = false,
}: {
  roster: RosterEntry[];
  /** Totals for the whole team, not just the names in `roster`. */
  counts: { safe: number; out: number; pending: number };
  perLine?: number;
  full?: boolean;
}) {
  const lines = GROUPS.map((g) => ({
    ...g,
    total: counts[g.state],
    names: roster.filter((r) => r.state === g.state),
  })).filter((g) => g.total > 0);

  if (lines.length === 0) return null;

  return (
    <span className={styles.roster} data-full={full}>
      {lines.map((g) => {
        const shown = full ? g.names : g.names.slice(0, perLine);
        const more = g.total - shown.length;
        return (
          <span key={g.state} className={styles.line} data-state={g.state}>
            <span className={styles.tag}>
              <ResultMark kind={markFor(g.state)} size={11} />
              {g.label}
              <span data-nums>{g.total}</span>
            </span>
            <span className={styles.names}>
              {shown.map((p, i) => (
                <span key={`${p.name}-${i}`} className={styles.player}>
                  <span className={styles.playerName}>{p.name}</span>
                  {/* A wildcard changes what a draw means for them, so
                      everyone reading the board gets to see who played one.
                      The full list is the one place not wrapped in a link, so
                      it can afford a badge that explains itself; board rows
                      make do with a hover title. */}
                  {p.isWildcard &&
                    (full ? (
                      <WildcardBadge />
                    ) : (
                      <span className={styles.wc} title={WILDCARD_RULE}>
                        WC
                      </span>
                    ))}
                  {i < shown.length - 1 ? ", " : ""}
                </span>
              ))}
              {more > 0 && <span className={styles.more}>{shown.length ? ` +${more}` : `+${more}`}</span>}
            </span>
          </span>
        );
      })}
    </span>
  );
}
