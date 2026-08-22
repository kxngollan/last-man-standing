import { describe, expect, it } from "vitest";
import { markFor } from "@/components/ui/ResultMark";
import { RESULT_META, wildcardMeta, pickMeta, teamWeekMeta } from "@/lib/game/pickMeta";

/**
 * The mark and the chip are two readings of one outcome, in two places. A week
 * that says "Out" in words and ticks in the margin is worse than no mark at
 * all, so they're pinned together here.
 */
const CHIP_MARK: Record<string, string> = {
  "lms-chip--safe": "tick",
  "lms-chip--out": "cross",
  "lms-chip--neutral": "minus",
};

describe("result marks", () => {
  it("marks a live pick state: tick through, cross out, dash unsettled", () => {
    expect(markFor("safe")).toBe("tick");
    expect(markFor("out")).toBe("cross");
    expect(markFor("pending")).toBe("minus");
  });

  it("never contradicts the chip it sits in", () => {
    for (const [result, meta] of Object.entries(RESULT_META)) {
      expect(meta.mark, `${result} (${meta.label})`).toBe(CHIP_MARK[meta.chip]);
    }
  });

  it("reads a wildcard week by its own rules", () => {
    const wc = (result: string) => wildcardMeta({ tla: "ARS", result });

    // A draw is a save, not an exit — so it ticks.
    expect(wc("draw").mark).toBe("tick");
    expect(wc("win").mark).toBe("tick");
    expect(wc("pending").mark).toBe("minus");
    // A loss still knocks them out, wildcard or not.
    expect(wc("loss").mark).toBe("cross");
    // The legacy teamless wildcard sits the week out safely.
    expect(wildcardMeta({ tla: null, result: "pending" }).mark).toBe("tick");
  });

  it("marks every outcome pickMeta can return", () => {
    for (const result of ["win", "draw", "loss", "safe", "postponed", "pending"]) {
      for (const isWildcard of [false, true]) {
        const meta = pickMeta({ tla: "ARS", result, isWildcard });
        expect(["tick", "cross", "minus"], `${result} wildcard=${isWildcard}`).toContain(meta.mark);
      }
    }
  });
});

describe("teamWeekMeta", () => {
  const counts = (safe: number, out: number, pending = 0) => ({ safe, out, pending });

  it("greens a team that took everyone through", () => {
    expect(teamWeekMeta(counts(10, 0), 10, "in-play")).toMatchObject({
      tone: "through",
      mark: "tick",
      label: "10/10 through",
    });
  });

  it("reds a team that took nobody through", () => {
    expect(teamWeekMeta(counts(0, 10), 10, "in-play")).toMatchObject({
      tone: "out",
      mark: "cross",
      label: "0/10 through",
    });
  });

  it("greys a drawn team, where only the wildcards came through", () => {
    // The 2 who survived a draw are the 2 who played a wildcard.
    expect(teamWeekMeta(counts(2, 8), 10, "in-play")).toMatchObject({
      tone: "split",
      mark: "minus",
      label: "2/10 through",
    });
  });

  it("stays neutral until the fixture has said something", () => {
    expect(teamWeekMeta(counts(0, 0, 10), 10, "in-play")).toMatchObject({
      tone: "pending",
      mark: "minus",
      label: "10 to play",
    });
  });

  it("counts heads instead of results on a week still open for picks", () => {
    expect(teamWeekMeta(counts(4, 0, 6), 10, "open")).toMatchObject({
      tone: "open",
      mark: null,
      label: "10 in",
    });
  });

  it("treats a part-settled week as split, not as finished", () => {
    // Two through, one out, one still playing — not "all through".
    expect(teamWeekMeta(counts(2, 1, 1), 4, "in-play").tone).toBe("split");
  });
});
