import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { getStandingsPage, getPickSummary, getGameStateForUser } from "@/lib/game/queries";
import {
  initDb,
  clearDb,
  closeDb,
  seedTeams,
  seedGame,
  seedEntry,
  seedFixtures,
  seedPick,
  fixtureApiId,
  past,
  future,
} from "./helpers";

beforeAll(initDb);
afterAll(closeDb);
beforeEach(clearDb);

/**
 * Picks are FULLY PUBLIC by design — including the open week's. Every player
 * sees the same live board (counts and names) while deciding, so nobody can
 * feel a result came out of nowhere.
 */
async function twoWeekSetup() {
  await seedTeams(4);
  const game = await seedGame({ currentMatchday: 2 });
  const alice = await seedEntry(game._id, "Alice");
  const bob = await seedEntry(game._id, "Bob");
  await seedFixtures(1, [{ home: 1, away: 2, kickoff: past(), status: "FINISHED", winner: "HOME_TEAM" }]);
  await seedFixtures(2, [{ home: 3, away: 4, kickoff: future(), status: "TIMED" }]);
  // Week 1 (finished): Alice took Team A. Week 2 (open): she's on Team C.
  await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
  await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 2, teamApiId: 3, fixtureApiId: fixtureApiId(2, 0) });
  return { game, alice, bob };
}

describe("standings pick transparency", () => {
  it("shows every entry's newest pick — including the open week's", async () => {
    const { bob } = await twoWeekSetup();

    // Bob (a rival) looks at the standings and sees Alice's live pick.
    const page = await getStandingsPage(String(bob.userId), 0, 25);
    const aliceRow = page.rows.find((r) => r.name.startsWith("Alice"));
    expect(aliceRow).toBeDefined();
    expect(aliceRow?.lastTeamTla).toBe("TCA"); // the open week-2 pick, not week 1's
  });

  it("shows picks even before the first deadline", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: future(), status: "TIMED" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });

    const page = await getStandingsPage(String(bob.userId), 0, 25);
    const aliceRow = page.rows.find((r) => r.name.startsWith("Alice"));
    expect(aliceRow?.lastTeamTla).toBe("TAA");
  });
});

describe("pick summary (live board)", () => {
  it("aggregates the OPEN pick week and names who's on each team", async () => {
    await twoWeekSetup();

    const summary = await getPickSummary();
    expect(summary).not.toBeNull();
    expect(summary?.matchday).toBe(2); // the week being picked, live
    expect(summary?.totalPicks).toBe(1);
    expect(summary?.teams[0]?.tla).toBe("TCA");
    expect(summary?.teams[0]?.players).toEqual(["Alice T."]);
  });

  it("shows picks as they land, before the deadline", async () => {
    await seedTeams(4);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [
      { home: 1, away: 2, kickoff: future(), status: "TIMED" },
      { home: 3, away: 4, kickoff: future(), status: "TIMED" },
    ]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });

    const summary = await getPickSummary();
    expect(summary?.totalPicks).toBe(2);
    expect(summary?.teams[0]?.count).toBe(2);
    expect(summary?.teams[0]?.players).toEqual(["Alice T.", "Bob T."]);
  });

  it("caps names per team for the compact boards while count stays truthful", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: future(), status: "TIMED" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });

    const capped = await getPickSummary({ playersPerTeam: 1 });
    expect(capped?.teams[0]?.players).toEqual(["Alice T."]); // alphabetical, capped
    expect(capped?.teams[0]?.count).toBe(2); // the real total drives "+N more"
    expect(capped?.totalPicks).toBe(2);
  });
});

describe("portal state", () => {
  it("derives used teams from pick rows and keeps my own open pick visible to me", async () => {
    const { alice } = await twoWeekSetup();

    const state = await getGameStateForUser(String(alice.userId));
    // I can always see my own current pick…
    expect(state.myPick?.teamApiId).toBe(3);
    // …and both my teams (locked and open week) count as used in the picker.
    const used = state.teams.filter((t) => t.used).map((t) => t.apiId);
    expect(used).toContain(3);
  });
});
