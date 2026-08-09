// How a pick's outcome reads: chip class, short label and a line of copy.
// Shared by /team and the profile timelines so the same result never gets
// described two different ways.

export interface PickMeta {
  chip: string;
  label: string;
  detail: string;
}

export const RESULT_META: Record<string, PickMeta> = {
  win: { chip: "lms-chip--safe", label: "Won", detail: "Won. Through to the next week." },
  safe: { chip: "lms-chip--safe", label: "Safe", detail: "Safe this week." },
  postponed: { chip: "lms-chip--safe", label: "Safe", detail: "Match postponed, counted as safe." },
  draw: { chip: "lms-chip--out", label: "Out", detail: "Drew. Knocked out here." },
  loss: { chip: "lms-chip--out", label: "Out", detail: "Lost. Knocked out here." },
  pending: { chip: "lms-chip--neutral", label: "This week", detail: "Awaiting this week’s result." },
};

/** Wildcard weeks read differently: a draw is a save, not an exit. */
export function wildcardMeta(p: { tla: string | null; result: string }): PickMeta {
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

/** The meta for any pick, wildcard rules included. */
export function pickMeta(p: { tla: string | null; result: string; isWildcard: boolean }): PickMeta {
  return p.isWildcard ? wildcardMeta(p) : RESULT_META[p.result] ?? RESULT_META.pending;
}
