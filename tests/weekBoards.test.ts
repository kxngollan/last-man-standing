import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import {
  getPickSummary,
  getWeekOptions,
  getGameStateForUser,
  getStandingsPage,
} from "@/lib/game/queries";
import type { PickSummary } from "@/lib/game/portalTypes";
import { Entry } from "@/models/Game/Entry";
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
 * Week 1 locked and being played, week 2 open for picks:
 *   Alice — Team A won, so she's safe and through to week 2
 *   Bob   — Team B lost, so he's out and can't be in week 2
 *   Cara  — Team C still playing, so her week 2 place isn't settled
 *   Dave  — already out of the game, with a stale week 2 pick-ahead row
 * Everyone has picked ahead for week 2.
 */
async function midWeekOne() {
  await seedTeams(8);
  const game = await seedGame();
  const alice = await seedEntry(game._id, "Alice");
  const bob = await seedEntry(game._id, "Bob");
  const cara = await seedEntry(game._id, "Cara");
  const dave = await seedEntry(game._id, "Dave", { status: "eliminated" });

  await seedFixtures(1, [
    { home: 1, away: 2, kickoff: past(4), status: "FINISHED", winner: "HOME_TEAM" },
    { home: 3, away: 4, kickoff: past(1), status: "IN_PLAY" },
  ]);
  await seedFixtures(2, [
    { home: 5, away: 6, kickoff: future(48), status: "TIMED" },
    { home: 7, away: 8, kickoff: future(50), status: "TIMED" },
  ]);

  const md1 = (e: { entry: { _id: unknown }; userId: unknown }, team: number, slot: number) =>
    seedPick({
      gameId: game._id,
      entryId: e.entry._id as never,
      userId: e.userId as never,
      matchday: 1,
      teamApiId: team,
      fixtureApiId: fixtureApiId(1, slot),
    });
  await md1(alice, 1, 0);
  await md1(bob, 2, 0);
  await md1(cara, 3, 1);

  const md2 = (e: { entry: { _id: unknown }; userId: unknown }, team: number, slot: number) =>
    seedPick({
      gameId: game._id,
      entryId: e.entry._id as never,
      userId: e.userId as never,
      matchday: 2,
      teamApiId: team,
      fixtureApiId: fixtureApiId(2, slot),
    });
  await md2(alice, 5, 0);
  await md2(bob, 6, 0);
  await md2(cara, 7, 1);
  await md2(dave, 8, 1);

  return { game, alice, bob, cara, dave };
}

/** One week's board, the way a screen asks for it. */
const board = async (gameWeek: number): Promise<PickSummary> =>
  (await getPickSummary({ gameWeek, playersPerTeam: 5, withState: true }))!;

/** The players on a board, by team, with the state each carries. */
function rosterOf(board: { teams: Array<{ tla: string; roster?: Array<{ name: string; state: string }> }> }) {
  return Object.fromEntries(
    board.teams.map((t) => [t.tla, (t.roster ?? []).map((r) => `${r.name}:${r.state}`)])
  );
}

describe("week boards", () => {
  it("offers one week button per week, and serves that week alone", async () => {
    await midWeekOne();

    expect(await getWeekOptions()).toEqual([
      { matchday: 1, gameWeek: 1, state: "in-play", locked: true },
      { matchday: 2, gameWeek: 2, state: "open", locked: false },
    ]);

    const week1 = await board(1);
    const week2 = await board(2);
    expect([week1.gameWeek, week1.state, week1.locked]).toEqual([1, "in-play", true]);
    expect([week2.gameWeek, week2.state, week2.locked]).toEqual([2, "open", false]);
  });

  it("shows the in-play week as it stands: who's safe, who's gone, who's playing", async () => {
    await midWeekOne();
    const inPlay = await board(1);

    expect(inPlay.totalPicks).toBe(3);
    expect(inPlay.counts).toEqual({ safe: 1, out: 1, pending: 1 });
    expect(rosterOf(inPlay)).toEqual({
      TAA: ["Alice T.:safe"],
      TBA: ["Bob T.:out"],
      TCA: ["Cara T.:pending"],
    });
  });

  it("leaves a player who is already out of the week off the next week's board", async () => {
    await midWeekOne();
    const open = await board(2);

    // Bob's team lost, so his week 2 pick-ahead is void; Dave is out of the
    // game entirely. Neither can be in week 2, so neither is on its board.
    expect(open.totalPicks).toBe(2);
    expect(open.excluded).toBe(2);
    expect(rosterOf(open)).toEqual({
      TEA: ["Alice T.:safe"], // through already — guaranteed to be in week 2
      TGA: ["Cara T.:pending"], // still playing week 1 for her place
    });
    expect(open.counts).toEqual({ safe: 1, pending: 1, out: 0 });
  });

  it("is one board while the week being played is still open for picks", async () => {
    await seedTeams(4);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: future(), status: "TIMED" }]);
    await seedPick({
      gameId: game._id,
      entryId: alice.entry._id,
      userId: alice.userId,
      matchday: 1,
      teamApiId: 1,
      fixtureApiId: fixtureApiId(1, 0),
    });

    // Only one week exists, so there is nothing to switch between.
    const options = await getWeekOptions();
    expect(options).toEqual([{ matchday: 1, gameWeek: 1, state: "in-play", locked: false }]);

    const week1 = await board(1);
    expect(week1).toMatchObject({ gameWeek: 1, state: "in-play", locked: false });
    expect(week1.counts).toEqual({ safe: 0, out: 0, pending: 1 });
  });

  it("counts a postponed fixture as safe, and a wildcard draw too", async () => {
    await seedTeams(4);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [
      { home: 1, away: 2, kickoff: past(4), status: "POSTPONED" },
      { home: 3, away: 4, kickoff: past(4), status: "FINISHED", winner: "DRAW" },
    ]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 3, fixtureApiId: fixtureApiId(1, 1), isWildcard: true });

    const inPlay = await board(1);
    expect(inPlay.counts).toEqual({ safe: 2, out: 0, pending: 0 });
  });

  it("shows a week already played as history — the players it knocked out included", async () => {
    await seedTeams(6);
    // Week 1 has been resolved: the game is on week 2 now.
    const game = await seedGame({ currentMatchday: 2 });
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob", { status: "eliminated" });
    await Entry.updateOne({ _id: bob.entry._id }, { $set: { eliminatedAtMatchday: 1 } });
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: past(72), status: "FINISHED", winner: "HOME_TEAM" }]);
    await seedFixtures(2, [{ home: 3, away: 4, kickoff: future(), status: "TIMED" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0), result: "win" });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0), result: "loss" });

    const week1 = await board(1);
    expect(week1.state).toBe("played");
    expect(week1.totalPicks).toBe(2);
    expect(week1.excluded).toBe(0); // nobody is filtered out of a week that happened
    expect(week1.counts).toEqual({ safe: 1, out: 1, pending: 0 });
    expect(rosterOf(week1)).toEqual({ TAA: ["Alice T.:safe"], TBA: ["Bob T.:out"] });
  });

  it("serves one asked-for week, and never a week that isn't open yet", async () => {
    await midWeekOne();

    expect((await getPickSummary({ gameWeek: 1 }))?.matchday).toBe(1);
    expect((await getPickSummary({ gameWeek: 2 }))?.matchday).toBe(2);
    // Week 9 hasn't opened — clamped back to the week being picked.
    expect((await getPickSummary({ gameWeek: 9 }))?.matchday).toBe(2);
    expect((await getPickSummary({ gameWeek: 0 }))?.matchday).toBe(1);
    // Default is the week open for picks.
    expect((await getPickSummary())?.matchday).toBe(2);
  });

  it("caps the names per team but keeps the real count, settled names first", async () => {
    await seedTeams(4);
    const game = await seedGame();
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: past(4), status: "FINISHED", winner: "HOME_TEAM" }]);
    // Two players on the winning team, and room to name only one of them.
    for (const name of ["Zoe", "Amy"]) {
      const e = await seedEntry(game._id, name);
      await seedPick({ gameId: game._id, entryId: e.entry._id, userId: e.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    }
    const board = await getPickSummary({ matchday: 1, playersPerTeam: 1, withState: true });
    const team = board!.teams[0];
    expect(team.count).toBe(2);
    expect(team.players).toEqual(["Amy T."]); // alphabetical among equals
    expect(team.roster).toEqual([{ name: "Amy T.", state: "safe" }]);
  });
});

describe("standings rows", () => {
  /** The pick each named player shows, for the week the board is on. */
  const picksOn = async (userId: string, week?: number) => {
    const { standings } = await getGameStateForUser(userId, { standingsWeek: week });
    return Object.fromEntries(
      standings.map((r) => [r.name, r.pick ? [r.pick.gameWeek, r.pick.teamName, r.pick.state] : null])
    );
  };

  it("shows the week being played by default, not a pick made for a later week", async () => {
    const { alice } = await midWeekOne();

    // Everyone has a week 2 pick in already; none of them belongs here.
    expect(await picksOn(String(alice.userId))).toEqual({
      "Alice T.": [1, "Team A", "safe"], // won — through
      "Bob T.": [1, "Team B", "out"], // lost — knocked out on it
      "Cara T.": [1, "Team C", "pending"], // still playing
      "Dave T.": null, // out of the game before this week
    });
  });

  it("moves the whole column to the week asked for", async () => {
    const { alice } = await midWeekOne();

    expect(await picksOn(String(alice.userId), 2)).toEqual({
      "Alice T.": [2, "Team E", "pending"],
      "Bob T.": [2, "Team F", "pending"],
      "Cara T.": [2, "Team G", "pending"],
      "Dave T.": null, // his pick-ahead row is void — he's out of the game
    });
  });

  it("keeps the flat field in step with the week on screen", async () => {
    const { alice } = await midWeekOne();
    const week1 = await getGameStateForUser(String(alice.userId), { standingsWeek: 1 });
    const week2 = await getGameStateForUser(String(alice.userId), { standingsWeek: 2 });

    expect(week1.myStanding?.lastTeamName).toBe("Team A");
    expect(week2.myStanding?.lastTeamName).toBe("Team E");
  });

  it("shows an out player the pick that ended them on the week it happened", async () => {
    const { game, dave } = await midWeekOne();
    await Entry.updateOne({ _id: dave.entry._id }, { $set: { eliminatedAtMatchday: 1 } });
    await seedPick({
      gameId: game._id,
      entryId: dave.entry._id,
      userId: dave.userId,
      matchday: 1,
      teamApiId: 4,
      fixtureApiId: fixtureApiId(1, 1),
      result: "loss",
    });

    expect((await picksOn(String(dave.userId), 1))["Dave T."]).toEqual([1, "Team D", "out"]);
    // …and nothing at all on the week he was no longer in.
    expect((await picksOn(String(dave.userId), 2))["Dave T."]).toBeNull();
  });

  it("clamps a week that doesn't exist back to a real one", async () => {
    const { alice } = await midWeekOne();
    const far = await picksOn(String(alice.userId), 9);
    expect(far["Alice T."]).toEqual([2, "Team E", "pending"]); // week 2 is as far as it goes
  });

  it("serves later pages on the same week as the first", async () => {
    const { alice } = await midWeekOne();
    const first = await getStandingsPage(String(alice.userId), 0, 2, 2);
    const second = await getStandingsPage(String(alice.userId), 2, 2, 2);
    for (const row of [...first.rows, ...second.rows]) {
      if (row.pick) expect(row.pick.gameWeek).toBe(2);
    }
    expect(first.rows.length + second.rows.length).toBe(4);
  });
});

describe("getGameStateForUser — the live week", () => {
  it("tells a player they're safe once their team has won", async () => {
    const { alice } = await midWeekOne();
    const state = await getGameStateForUser(String(alice.userId));

    expect(state.liveWeek).toMatchObject({
      matchday: 1,
      gameWeek: 1,
      teamName: "Team A",
      state: "safe",
    });
    expect(state.liveWeek?.detail).toMatch(/won/i);
    expect(state.liveWeek?.detail).toMatch(/through/i);
  });

  it("tells a player they're out once their team has lost", async () => {
    const { bob } = await midWeekOne();
    const state = await getGameStateForUser(String(bob.userId));

    expect(state.liveWeek?.state).toBe("out");
    expect(state.liveWeek?.detail).toMatch(/out/i);
    // Still officially alive — the resolver hasn't run.
    expect(state.entry?.status).toBe("alive");
    expect((await Entry.findById(bob.entry._id))?.status).toBe("alive");
  });

  it("leaves the week open while the match is still on", async () => {
    const { cara } = await midWeekOne();
    const state = await getGameStateForUser(String(cara.userId));

    expect(state.liveWeek?.state).toBe("pending");
    expect(state.liveWeek?.teamName).toBe("Team C");
  });

  it("reads the live week, not the week being picked ahead", async () => {
    const { alice } = await midWeekOne();
    const state = await getGameStateForUser(String(alice.userId));

    // The pick window has moved on to week 2 — the live read stays on week 1.
    expect(state.pickGameWeek).toBe(2);
    expect(state.myPick?.teamName).toBe("Team E");
    expect(state.liveWeek?.gameWeek).toBe(1);
    expect(state.liveWeek?.teamName).toBe("Team A");
  });

  it("has nothing to say when the player hasn't picked that week", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: future(), status: "TIMED" }]);

    const state = await getGameStateForUser(String(alice.userId));
    expect(state.liveWeek).toBeNull();
  });
});
