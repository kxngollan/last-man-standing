import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { makePick, playWildcard, undoWildcard } from "@/lib/game/pick";
import { GameError } from "@/lib/game/errors";
import { Pick } from "@/models/Pick";
import { Entry } from "@/models/Entry";
import {
  initDb,
  clearDb,
  closeDb,
  seedTeams,
  seedGame,
  seedEntry,
  seedFixtures,
  seedPick,
  future,
  past,
} from "./helpers";

beforeAll(initDb);
afterAll(closeDb);

describe("makePick", () => {
  beforeEach(clearDb);

  async function week1Setup() {
    await seedTeams(4);
    const game = await seedGame();
    const { entry, userId } = await seedEntry(game._id, "Alice");
    // Week 1 hasn't kicked off: open for picks.
    await seedFixtures(1, [
      { home: 1, away: 2, kickoff: future(), status: "TIMED" },
      { home: 3, away: 4, kickoff: future(), status: "TIMED" },
    ]);
    return { game, entry, userId };
  }

  it("records a pick and allows changing it within the same week", async () => {
    const { entry, userId } = await week1Setup();

    await makePick(String(userId), 1);
    let picks = await Pick.find({ entryId: entry._id });
    expect(picks).toHaveLength(1);
    expect(picks[0].teamApiId).toBe(1);

    await makePick(String(userId), 3); // change of heart — same week
    picks = await Pick.find({ entryId: entry._id });
    expect(picks).toHaveLength(1);
    expect(picks[0].teamApiId).toBe(3);
  });

  it("rejects a team already used in an earlier week", async () => {
    await seedTeams(4);
    const game = await seedGame({ currentMatchday: 2 });
    const { entry, userId } = await seedEntry(game._id, "Alice");
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);
    await seedFixtures(2, [
      { home: 1, away: 3, kickoff: future(), status: "TIMED" },
      { home: 2, away: 4, kickoff: future(), status: "TIMED" },
    ]);
    await seedPick({ gameId: game._id, entryId: entry._id, userId, matchday: 1, teamApiId: 1 });

    await expect(makePick(String(userId), 1)).rejects.toThrow(/already used that team/);
    await makePick(String(userId), 2); // fine — team 2 is fresh
    const pick = await Pick.findOne({ entryId: entry._id, matchday: 2 });
    expect(pick?.teamApiId).toBe(2);
  });

  it("enforces once-per-game at the database level (unique index)", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const { entry, userId } = await seedEntry(game._id, "Alice");
    await seedPick({ gameId: game._id, entryId: entry._id, userId, matchday: 1, teamApiId: 1 });

    // Even a raw write bypassing makePick can't reuse the team.
    await expect(
      seedPick({ gameId: game._id, entryId: entry._id, userId, matchday: 2, teamApiId: 1 })
    ).rejects.toMatchObject({ code: 11000 });

    // Legacy teamless wildcard rows are exempt (partial index).
    await seedPick({ gameId: game._id, entryId: entry._id, userId, matchday: 2, teamApiId: null });
    await seedPick({ gameId: game._id, entryId: entry._id, userId, matchday: 3, teamApiId: null });
  });

  it("refuses picks for a locked week", async () => {
    await seedTeams(2);
    const game = await seedGame({ currentMatchday: 38 }); // no next week to fall to
    const { userId } = await seedEntry(game._id, "Alice");
    await seedFixtures(38, [{ home: 1, away: 2, kickoff: past(), status: "IN_PLAY" }]);

    await expect(makePick(String(userId), 1)).rejects.toThrow(/no open game week/);
  });

  it("refuses a team that doesn't play this week", async () => {
    const { userId } = await week1Setup();
    await expect(makePick(String(userId), 99)).rejects.toThrow(/doesn’t play/);
  });
});

describe("wildcard", () => {
  beforeEach(clearDb);

  async function setupWithPick() {
    await seedTeams(4);
    const game = await seedGame();
    const { entry, userId } = await seedEntry(game._id, "Alice");
    await seedFixtures(1, [
      { home: 1, away: 2, kickoff: future(), status: "TIMED" },
      { home: 3, away: 4, kickoff: future(), status: "TIMED" },
    ]);
    await makePick(String(userId), 1);
    return { game, entry, userId };
  }

  it("arms on the current pick and can be undone", async () => {
    const { entry, userId } = await setupWithPick();

    await playWildcard(String(userId));
    expect((await Pick.findOne({ entryId: entry._id, matchday: 1 }))?.isWildcard).toBe(true);
    expect((await Entry.findById(entry._id))?.wildcardUsed).toBe(true);

    await undoWildcard(String(userId));
    expect((await Pick.findOne({ entryId: entry._id, matchday: 1 }))?.isWildcard).toBe(false);
    expect((await Entry.findById(entry._id))?.wildcardUsed).toBe(false);
  });

  it("can only be used once per game", async () => {
    const { userId } = await setupWithPick();
    await playWildcard(String(userId));
    await expect(playWildcard(String(userId))).rejects.toThrow(/already used your wildcard/);
  });

  it("requires a pick to attach to — and releases the claim when there is none", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const { entry, userId } = await seedEntry(game._id, "Alice");
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: future(), status: "TIMED" }]);

    await expect(playWildcard(String(userId))).rejects.toThrow(/Pick a team first/);
    // The atomic claim must have been rolled back — the wildcard is still available.
    expect((await Entry.findById(entry._id))?.wildcardUsed).toBe(false);
  });

  it("keeps an armed wildcard armed when the pick changes team", async () => {
    const { entry, userId } = await setupWithPick();
    await playWildcard(String(userId));
    await makePick(String(userId), 3);
    const pick = await Pick.findOne({ entryId: entry._id, matchday: 1 });
    expect(pick?.teamApiId).toBe(3);
    expect(pick?.isWildcard).toBe(true);
  });

  it("double-invocation race claims exactly once", async () => {
    const { userId } = await setupWithPick();
    const results = await Promise.allSettled([
      playWildcard(String(userId)),
      playWildcard(String(userId)),
    ]);
    const failed = results.filter((r) => r.status === "rejected");
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(GameError);
  });
});

describe("makePick concurrency", () => {
  beforeEach(clearDb);

  it("two entries picking simultaneously don't interfere", async () => {
    await seedTeams(4);
    const game = await seedGame();
    const a = await seedEntry(game._id, "Alice");
    const b = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [
      { home: 1, away: 2, kickoff: future(), status: "TIMED" },
      { home: 3, away: 4, kickoff: future(), status: "TIMED" },
    ]);

    await Promise.all([makePick(String(a.userId), 1), makePick(String(b.userId), 1)]);
    expect(await Pick.countDocuments({ gameId: game._id, matchday: 1 })).toBe(2);
  });

  it("concurrent picks by the same entry settle on exactly one row", async () => {
    await seedTeams(4);
    const game = await seedGame();
    const { entry, userId } = await seedEntry(game._id, "Alice");
    await seedFixtures(1, [
      { home: 1, away: 2, kickoff: future(), status: "TIMED" },
      { home: 3, away: 4, kickoff: future(), status: "TIMED" },
    ]);

    // Double-click / two tabs: both may succeed (last write wins) but state
    // must stay consistent — one row, and its team is one of the two.
    const results = await Promise.allSettled([
      makePick(String(userId), 1),
      makePick(String(userId), 3),
    ]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);

    const picks = await Pick.find({ entryId: entry._id, matchday: 1 });
    expect(picks).toHaveLength(1);
    expect([1, 3]).toContain(picks[0].teamApiId);
  });
});
