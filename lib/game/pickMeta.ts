// How a pick's outcome reads: chip class, short label and a line of copy.
// Shared by /team and the profile timelines so the same result never gets
// described two different ways.

import type { ResultMarkKind } from "./portalTypes";

export interface PickMeta {
  chip: string;
  label: string;
  detail: string;
  /** Tick through, cross out, dash not settled — drawn beside the label. */
  mark: ResultMarkKind;
}

export const RESULT_META: Record<string, PickMeta> = {
  win: { chip: "lms-chip--safe", label: "Won", detail: "Won. Through to the next week.", mark: "tick" },
  safe: { chip: "lms-chip--safe", label: "Safe", detail: "Safe this week.", mark: "tick" },
  postponed: {
    chip: "lms-chip--safe",
    label: "Safe",
    detail: "Match postponed, counted as safe.",
    mark: "tick",
  },
  draw: { chip: "lms-chip--out", label: "Out", detail: "Drew. Knocked out here.", mark: "cross" },
  loss: { chip: "lms-chip--out", label: "Out", detail: "Lost. Knocked out here.", mark: "cross" },
  pending: {
    chip: "lms-chip--neutral",
    label: "This week",
    detail: "Awaiting this week’s result.",
    mark: "minus",
  },
};

/** How a whole team's game week reads on a picks board. */
export interface TeamWeekMeta {
  /** Colour band: green all through, red all out, grey anything in between. */
  tone: "through" | "out" | "split" | "pending" | "open";
  /** Mark beside the team name, or null before there's anything to say. */
  mark: ResultMarkKind | null;
  /** The tally, e.g. "10/10 through". */
  label: string;
  /** Spelled out, for a screen reader and the row's title. */
  detail: string;
}

/**
 * A team's week from the counts of the players who picked it.
 *
 * A won fixture puts every one of them through, a lost one puts none through,
 * and a draw splits them: only the players who played a wildcard survive it.
 * That's why a tally like "2/10 through" is a real result and not a rounding
 * error — those two are the wildcards.
 */
export function teamWeekMeta(
  counts: { safe: number; out: number; pending: number },
  total: number,
  weekState: "played" | "in-play" | "open"
): TeamWeekMeta {
  const { safe, out, pending } = counts;

  // A week nobody has played yet: the story is who's on it, not how it went.
  if (weekState === "open") {
    return {
      tone: "open",
      mark: null,
      label: `${total} in`,
      detail: `${total} ${total === 1 ? "player" : "players"} on this team`,
    };
  }
  if (safe + out === 0) {
    // Nothing decided yet — so the number on it is the only news there is.
    return {
      tone: "pending",
      mark: "minus",
      label: `${total} to play`,
      detail: `${total} ${total === 1 ? "player" : "players"} still to play`,
    };
  }

  const label = `${safe}/${total} through`;
  if (out === 0 && pending === 0) {
    return { tone: "through", mark: "tick", label, detail: `All ${total} through` };
  }
  if (safe === 0 && pending === 0) {
    return { tone: "out", mark: "cross", label, detail: `All ${total} knocked out` };
  }
  return {
    tone: "split",
    mark: "minus",
    label,
    detail: `${safe} of ${total} through, ${out} out${pending ? `, ${pending} still to play` : ""}`,
  };
}

/** Wildcard weeks read differently: a draw is a save, not an exit. */
export function wildcardMeta(p: { tla: string | null; result: string }): PickMeta {
  if (!p.tla) {
    // Legacy teamless wildcard (skip-the-week rules).
    return {
      chip: "lms-chip--wild",
      label: "Wildcard",
      detail: "Wildcard played. Safe this week.",
      mark: "tick",
    };
  }
  switch (p.result) {
    case "pending":
      return {
        chip: "lms-chip--wild",
        label: "Wildcard on",
        detail: "Wildcard played — win or draw and you’re through.",
        mark: "minus",
      };
    case "draw":
      return {
        chip: "lms-chip--wild",
        label: "Wildcard save",
        detail: "Drew — the wildcard kept you in.",
        mark: "tick",
      };
    case "win":
      return {
        chip: "lms-chip--safe",
        label: "Won",
        detail: "Won — the wildcard wasn’t needed.",
        mark: "tick",
      };
    default:
      return RESULT_META[p.result] ?? RESULT_META.pending;
  }
}

/** The meta for any pick, wildcard rules included. */
export function pickMeta(p: { tla: string | null; result: string; isWildcard: boolean }): PickMeta {
  return p.isWildcard ? wildcardMeta(p) : RESULT_META[p.result] ?? RESULT_META.pending;
}
