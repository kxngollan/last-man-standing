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
 * Game in week 2: week 1 finished (locked), week 2 not kicked off (open).
 * Alice's week-2 pick must stay invisible to everyone until the deadline.
 */
async function twoWeekSetup() {
  await seedTeams(4);
  const game = await seedGame({ currentMatchday: 2 });
  const alice = await seedEntry(game._id, "Alice");
  const bob = await seedEntry(game._id, "Bob");
  await seedFixtures(1, [{ home: 1, away: 2, kickoff: past(), status: "FINISHED", winner: "HOME_TEAM" }]);
  await seedFixtures(2, [{ home: 3, away: 4, kickoff: future(), status: "TIMED" }]);
  // Week 1 (locked): Alice took Team A. Week 2 (open): she's on Team C.
  await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
  await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 2, teamApiId: 3, fixtureApiId: fixtureApiId(2, 0) });
  return { game, alice, bob };
}

describe("standings pick visibility", () => {
  it("shows the last LOCKED pick, never the open week's", async () => {
    const { bob } = await twoWeekSetup();

    // Bob (a rival) looks at the standings.
    const page = await getStandingsPage(String(bob.userId), 0, 25);
    const aliceRow = page.rows.find((r) => r.name.startsWith("Alice"));
    expect(aliceRow).toBeDefined();
    expect(aliceRow?.lastTeamTla).toBe("TAA"); // week 1's Team A
    expect(aliceRow?.lastTeamTla).not.toBe("TCA"); // never week 2's open pick
  });

  it("shows no pick at all before the first deadline", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: future(), status: "TIMED" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });

    const page = await getStandingsPage(String(bob.userId), 0, 25);
    const aliceRow = page.rows.find((r) => r.name.startsWith("Alice"));
    expect(aliceRow?.lastTeamTla).toBeNull();
    expect(aliceRow?.lastTeamName).toBeNull();
  });
});

describe("pick summary visibility", () => {
  it("aggregates only the latest locked week", async () => {
    await twoWeekSetup();

    const summary = await getPickSummary();
    expect(summary).not.toBeNull();
    expect(summary?.matchday).toBe(1); // locked week, not the open week 2
    expect(summary?.totalPicks).toBe(1);
    expect(summary?.teams[0]?.tla).toBe("TAA");
  });

  it("is empty before any week has locked", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: future(), status: "TIMED" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });

    const summary = await getPickSummary();
    expect(summary?.totalPicks).toBe(0);
    expect(summary?.teams).toHaveLength(0);
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
