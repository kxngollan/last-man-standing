import Link from "next/link";
import type { WeekOption } from "@/lib/game/portalTypes";
import styles from "./WeekBar.module.css";

const TAG: Record<WeekOption["state"], string> = {
  played: "done",
  "in-play": "live",
  open: "open",
};

/**
 * The game week buttons. One week is on screen at a time — these move between
 * them, and everything below reads the week they choose.
 *
 * Links rather than client state: the week lives in the URL, so it survives a
 * refresh, can be shared, and the whole page (picks board and standings alike)
 * agrees on which week it is showing. `scroll={false}` keeps the page where it
 * is, since the bar usually sits below the fold.
 */
export function WeekBar({
  weeks,
  selected,
  href,
  label = "Game week",
}: {
  weeks: WeekOption[];
  /** The game week being shown. */
  selected: number;
  /** Builds the link for a week, e.g. (w) => `/picks?week=${w}`. */
  href: (gameWeek: number) => string;
  label?: string;
}) {
  if (weeks.length < 2) return null;

  return (
    <div className={styles.bar}>
      <span className={styles.label}>{label}</span>
      <div className={styles.weeks} role="group" aria-label={`${label} — choose a week`}>
        {weeks.map((w) => (
          <Link
            key={w.matchday}
            href={href(w.gameWeek)}
            scroll={false}
            className={styles.week}
            aria-current={w.gameWeek === selected ? "page" : undefined}
          >
            <span data-nums>W{w.gameWeek}</span>
            {w.state !== "played" && <span className={styles.tag}>{TAG[w.state]}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
