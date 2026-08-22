import { TeamCrest } from "./TeamCrest";
import { ResultMark } from "@/components/ui/ResultMark";
import { pickMeta, type PickMeta } from "@/lib/game/pickMeta";
import styles from "./PickTimeline.module.css";

/** One week on the timeline. Loose enough for both /team and profile rows. */
export interface TimelinePick {
  matchday: number;
  gameWeek: number;
  teamName: string | null;
  tla: string | null;
  crest: string | null;
  result: string;
  isWildcard: boolean;
  autoPicked?: boolean;
  /** Your own pick for a week that hasn't started — profiles only. */
  hiddenFromOthers?: boolean;
}

/** A pick nobody else can see here yet — the outcome isn't the story. */
const hiddenMeta = (gameWeek: number): PickMeta => ({
  chip: "lms-chip--neutral",
  label: "Hidden",
  detail: `Locked in for Week ${gameWeek}. Only you see this here until the week starts.`,
  mark: "minus",
});

/**
 * A player's picks down the weeks — shared by /team and profiles so a week
 * reads the same wherever you meet it.
 */
export function PickTimeline({ picks }: { picks: TimelinePick[] }) {
  return (
    <ol className={styles.timeline}>
      {picks.map((p) => {
        const meta = p.hiddenFromOthers ? hiddenMeta(p.gameWeek) : pickMeta(p);
        return (
          <li
            key={p.matchday}
            className={styles.entry}
            data-pending={p.result === "pending" && !p.hiddenFromOthers}
            data-hidden={p.hiddenFromOthers === true}
          >
            <div className={styles.marker} aria-hidden="true">
              <span className={styles.gw} data-nums>
                GW{p.gameWeek}
              </span>
            </div>
            <div className={`lms-panel ${styles.card}`}>
              <TeamCrest crest={p.crest} tla={p.tla ?? (p.isWildcard ? "WC" : null)} size="lg" />
              <div className={styles.body}>
                <div className={styles.teamLine}>
                  <span className={styles.team}>
                    {p.teamName ?? (p.isWildcard ? "Wildcard" : "—")}
                  </span>
                  {p.autoPicked && (
                    <span className={styles.auto} title="Picked for you when the deadline passed">
                      auto
                    </span>
                  )}
                </div>
                <p className={styles.detail}>{meta.detail}</p>
              </div>
              <span className={`lms-chip ${meta.chip}`}>
                <ResultMark kind={meta.mark} size={12} />
                {meta.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
