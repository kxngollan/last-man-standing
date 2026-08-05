import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { resolveMatchday, autoPickForMatchday } from "@/lib/game/resolve";
import { acquireLock, releaseLock } from "@/lib/locks";
import { Game } from "@/models/Game";
import { Entry } from "@/models/Entry";
import { Pick } from "@/models/Pick";
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

describe("resolveMatchday", () => {
  it("advances the week: losers and non-wildcard draws are out, winners through", async () => {
    await seedTeams(6);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    const cara = await seedEntry(game._id, "Cara");
    const dan = await seedEntry(game._id, "Dan");
    await seedFixtures(1, [
      { home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" },
      { home: 3, away: 4, status: "FINISHED", winner: "DRAW" },
      { home: 5, away: 6, status: "FINISHED", winner: "HOME_TEAM" },
    ]);
    const f = (slot: number) => fixtureApiId(1, slot);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: f(0) }); // win
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: f(0) }); // loss
    await seedPick({ gameId: game._id, entryId: cara.entry._id, userId: cara.userId, matchday: 1, teamApiId: 3, fixtureApiId: f(1) }); // draw, no wildcard
    await seedPick({ gameId: game._id, entryId: dan.entry._id, userId: dan.userId, matchday: 1, teamApiId: 4, fixtureApiId: f(1), isWildcard: true }); // draw + wildcard

    const result = await resolveMatchday(String(game._id));
    expect(result).toMatchObject({ complete: true, outcome: "advanced", eliminated: 2, aliveNow: 2 });

    const fresh = await Game.findById(game._id);
    expect(fresh?.currentMatchday).toBe(2);
    expect((await Entry.findById(alice.entry._id))?.status).toBe("alive");
    expect((await Entry.findById(bob.entry._id))?.status).toBe("eliminated");
    expect((await Entry.findById(bob.entry._id))?.eliminatedAtMatchday).toBe(1);
    expect((await Entry.findById(cara.entry._id))?.status).toBe("eliminated");
    expect((await Entry.findById(dan.entry._id))?.status).toBe("alive");
    expect((await Pick.findOne({ entryId: dan.entry._id }))?.result).toBe("draw");
  });

  it("crowns the last player standing", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0) });

    const result = await resolveMatchday(String(game._id));
    expect(result.outcome).toBe("winner");

    const fresh = await Game.findById(game._id);
    expect(fresh?.status).toBe("finished");
    expect(String(fresh?.winnerUserId)).toBe(String(alice.userId));
    expect(fresh?.noWinner).toBe(false);
    expect((await Entry.findById(alice.entry._id))?.status).toBe("winner");
  });

  it("ends all-out with no winner when everyone loses", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0) });

    const result = await resolveMatchday(String(game._id));
    expect(result.outcome).toBe("all-out");
    const fresh = await Game.findById(game._id);
    expect(fresh?.status).toBe("finished");
    expect(fresh?.noWinner).toBe(true);
  });

  it("never turns a crowned winner into 'no winner' on a re-run", async () => {
    // Simulates the interrupted run: winner entry saved, game save failed.
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice", { status: "winner" });
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);

    const result = await resolveMatchday(String(game._id));
    expect(result.outcome).toBe("winner");
    const fresh = await Game.findById(game._id);
    expect(fresh?.status).toBe("finished");
    expect(fresh?.noWinner).toBe(false);
    expect(String(fresh?.winnerUserId)).toBe(String(alice.userId));
  });

  it("waits while fixtures are still playing — unless forced, which scores them safe", async () => {
    await seedTeams(4);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [
      { home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" },
      { home: 3, away: 4, status: "SUSPENDED" }, // wedged forever
    ]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0) }); // loss
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 3, fixtureApiId: fixtureApiId(1, 1) }); // stuck

    const blocked = await resolveMatchday(String(game._id));
    expect(blocked.complete).toBe(false);

    const forced = await resolveMatchday(String(game._id), { force: true });
    expect(forced).toMatchObject({ complete: true, outcome: "winner" });
    expect((await Pick.findOne({ entryId: bob.entry._id }))?.result).toBe("postponed");
    expect((await Entry.findById(bob.entry._id))?.status).toBe("winner");
  });

  it("treats AWARDED fixtures as decided", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [{ home: 1, away: 2, status: "AWARDED", winner: "AWAY_TEAM" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0) });

    const result = await resolveMatchday(String(game._id));
    expect(result.outcome).toBe("winner");
    expect((await Entry.findById(alice.entry._id))?.status).toBe("eliminated");
    expect((await Entry.findById(bob.entry._id))?.status).toBe("winner");
  });

  it("scores postponed fixtures as safe", async () => {
    await seedTeams(4);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [
      { home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" },
      { home: 3, away: 4, status: "POSTPONED" },
    ]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 3, fixtureApiId: fixtureApiId(1, 1) });

    const result = await resolveMatchday(String(game._id));
    expect(result).toMatchObject({ outcome: "advanced", eliminated: 0, aliveNow: 2 });
    expect((await Pick.findOne({ entryId: bob.entry._id }))?.result).toBe("postponed");
  });

  it("eliminates an entry with no pick and no assignable team", async () => {
    await seedTeams(2);
    const game = await seedGame({ currentMatchday: 3 });
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    // Alice has already burned both teams that play in week 3.
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1 });
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 2, teamApiId: 2 });
    await seedFixtures(3, [{ home: 1, away: 2, status: "FINISHED", winner: "DRAW" }]);
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 3, teamApiId: 1, fixtureApiId: fixtureApiId(3, 0), isWildcard: true });

    const result = await resolveMatchday(String(game._id));
    expect(result.outcome).toBe("winner"); // Bob's wildcard draw survives; Alice is out
    expect((await Entry.findById(alice.entry._id))?.status).toBe("eliminated");
  });

  it("deletes an eliminated player's future picks and refunds a wildcard armed on one", async () => {
    await seedTeams(4);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob", { wildcardUsed: true });
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);
    await seedFixtures(2, [{ home: 3, away: 4, kickoff: future(), status: "TIMED" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0) });
    // Bob picked ahead for week 2 and played his wildcard on it.
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 2, teamApiId: 3, fixtureApiId: fixtureApiId(2, 0), isWildcard: true });

    await resolveMatchday(String(game._id));

    expect(await Pick.findOne({ entryId: bob.entry._id, matchday: 2 })).toBeNull();
    expect((await Entry.findById(bob.entry._id))?.wildcardUsed).toBe(false);
  });

  it("is a no-op while another resolver holds the lease", async () => {
    await seedTeams(2);
    const game = await seedGame();
    await seedEntry(game._id, "Alice");
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);

    await acquireLock(`resolve:${game._id}`, 60_000);
    try {
      const result = await resolveMatchday(String(game._id));
      expect(result.complete).toBe(false);
      expect(result.message).toMatch(/already running/i);
    } finally {
      await releaseLock(`resolve:${game._id}`);
    }
  });

  it("re-running a finished game is a no-op", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });

    await resolveMatchday(String(game._id));
    const again = await resolveMatchday(String(game._id));
    expect(again.complete).toBe(false);
    expect(again.message).toMatch(/not active/i);
  });
});

describe("autoPickForMatchday", () => {
  it("does nothing before the deadline", async () => {
    await seedTeams(2);
    const game = await seedGame();
    await seedEntry(game._id, "Alice");
    await seedFixtures(1, [{ home: 1, away: 2, kickoff: future(), status: "TIMED" }]);

    expect(await autoPickForMatchday(game, 1)).toBe(0);
    expect(await Pick.countDocuments({ gameId: game._id })).toBe(0);
  });

  it("assigns the alphabetically-first unused team from playable fixtures, idempotently", async () => {
    await seedTeams(6);
    const game = await seedGame({ currentMatchday: 2 });
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(2, [
      { home: 1, away: 2, kickoff: past(), status: "POSTPONED" }, // A & B unassignable
      { home: 3, away: 4, kickoff: past(), status: "IN_PLAY" },
      { home: 5, away: 6, kickoff: past(), status: "IN_PLAY" },
    ]);
    // Alice used Team C (3) in week 1 and missed this week's deadline;
    // Bob has picked this week already.
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 3 });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 2, teamApiId: 5, fixtureApiId: fixtureApiId(2, 2) });

    const assigned = await autoPickForMatchday(game, 2);
    expect(assigned).toBe(1); // only Alice was missing a pick

    const alicePick = await Pick.findOne({ entryId: alice.entry._id, matchday: 2 });
    // Teams A/B are postponed, C is used → D (apiId 4) is the first assignable.
    expect(alicePick?.teamApiId).toBe(4);
    expect(alicePick?.autoPicked).toBe(true);

    expect(await autoPickForMatchday(game, 2)).toBe(0); // second run: nothing to do
  });
});
