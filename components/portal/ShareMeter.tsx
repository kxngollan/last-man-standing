import styles from "./ShareMeter.module.css";

/**
 * How one team's pick count compares with the week's most-picked team, as a
 * meter: the biggest fills the track, and everything else is drawn to that
 * scale (5 picks fills it, 2 picks fills 40% of it). Scaled this way the rows
 * rank at a glance even in a week where no team took more than a fifth of the
 * field — the exact share is spelled out in the text beside it.
 *
 * Filled in `--color-ink` — black on light, white on dark — because the row
 * behind it is already carrying a colour for the result, and a third tint there
 * read as decoration. Ink is the one fill that stays obvious against a green,
 * a red and a grey row alike.
 */
export function ShareMeter({
  value,
  max,
  label,
}: {
  /** This team's picks. */
  value: number;
  /** Picks on the week's most-picked team — the full width of the track. */
  max: number;
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <span className={styles.track} role="img" aria-label={label}>
      <span className={styles.fill} style={{ width: `${pct}%` }} />
    </span>
  );
}
