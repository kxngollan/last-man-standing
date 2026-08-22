import type { ResultMarkKind } from "@/lib/game/portalTypes";

export type { ResultMarkKind };

/**
 * The three marks a game week can leave on a player: through, out, or not
 * settled yet. Hand-drawn strokes rather than glyphs (✓/✕ render at wildly
 * different weights across fonts) and they draw in `currentColor`, so the
 * colour comes from whatever the mark sits inside.
 *
 * Presentational only (no hooks) so it works in server and client components.
 * Decorative by default — a row that already says "Out" in words shouldn't say
 * it twice to a screen reader. Pass `label` where the mark is the only thing
 * carrying the meaning.
 */
const PATHS: Record<ResultMarkKind, string> = {
  tick: "m5 12.5 4.5 4.5L19 7",
  cross: "M7 7l10 10M17 7 7 17",
  minus: "M6.5 12h11",
};

/** Which mark a pick's state earns. */
export const markFor = (state: "safe" | "out" | "pending"): ResultMarkKind =>
  state === "safe" ? "tick" : state === "out" ? "cross" : "minus";

export function ResultMark({
  kind,
  size = 14,
  label,
  className,
}: {
  kind: ResultMarkKind;
  /** Pixel size of the square. Inherits colour from the parent either way. */
  size?: number;
  /** Announce the mark, for where it's the only cue. Omit to hide it. */
  label?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={kind === "minus" ? 2.75 : 2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      style={{ flex: "none", verticalAlign: "-0.15em" }}
    >
      <path d={PATHS[kind]} />
    </svg>
  );
}
