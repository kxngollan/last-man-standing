import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { Entry } from "@/models/Game/Entry";
import type { EntryStatus } from "@/models/Game/Entry";
import type { PickResult } from "@/models/Game/Pick";
import { getUserProfile } from "@/lib/game/profile";
import { initDb, clearDb, closeDb, seedTeams, seedGame, seedEntry, seedPick, seedUser } from "./helpers";

beforeAll(initDb);
afterAll(closeDb);
beforeEach(clearDb);

/**
 * A profile stops at the week being played. Unlike the standings and the
 * /picks board — which publish the open week on purpose — a pick for a game
 * week that hasn't started is shown to nobody but the player who made it, and
 * counts towards nothing until it has been played.
 */

/** An entry for an existing user (seedEntry always makes a new one). */
function entryFor(
  gameId: Types.ObjectId,
  userId: Types.ObjectId,
  opts: { status?: EntryStatus; eliminatedAtMatchday?: number | null } = {}
) {
  return Entry.create({
    gameId,
    userId,
    status: opts.status ?? "alive",
    eliminatedAtMatchday: opts.eliminatedAtMatchday ?? null,
  });
}

/**
 * The game is on matchday 2, and Alice has already picked for matchday 3 —
 * the one week ahead the pick window ever allows.
 */
async function aheadPickSetup() {
  await seedTeams(6);
  const game = await seedGame({ startMatchday: 1, currentMatchday: 2 });
  const alice = await seedEntry(game._id, "Alice");
  const bob = await seedEntry(game._id, "Bob");
  const pick = (matchday: number, teamApiId: number, result: PickResult = "pending") =>
    seedPick({
      gameId: game._id,
      entryId: alice.entry._id,
      userId: alice.userId,
      matchday,
      teamApiId,
      result,
    });
  await pick(1, 1, "win"); // played
  await pick(2, 2); // the week in play
  await pick(3, 3); // picked ahead — hidden from everyone else
  return { game, alice, bob };
}

describe("profile pick visibility", () => {
  it("hides a pick for a week that hasn't started from other players", async () => {
    const { alice, bob } = await aheadPickSetup();

    const profile = await getUserProfile(String(alice.userId), String(bob.userId));
    const picks = profile!.current!.picks;

    expect(picks.map((p) => p.matchday)).toEqual([1, 2]);
    expect(picks.some((p) => p.hiddenFromOthers)).toBe(false);
  });

  it("shows the owner their own ahead pick, flagged as hidden from others", async () => {
    const { alice } = await aheadPickSetup();

    const profile = await getUserProfile(String(alice.userId), String(alice.userId));
    const picks = profile!.current!.picks;

    expect(profile!.isSelf).toBe(true);
    expect(picks.map((p) => p.matchday)).toEqual([1, 2, 3]);
    expect(picks.find((p) => p.matchday === 3)!.hiddenFromOthers).toBe(true);
    expect(picks.find((p) => p.matchday === 2)!.hiddenFromOthers).toBe(false);
  });

  it("keeps the played weeks and the week in play, with their results", async () => {
    const { alice, bob } = await aheadPickSetup();

    const picks = (await getUserProfile(String(alice.userId), String(bob.userId)))!.current!.picks;
    const [gw1, gw2] = picks;

    expect(gw1).toMatchObject({ gameWeek: 1, teamName: "Team A", result: "win" });
    expect(gw2).toMatchObject({ gameWeek: 2, teamName: "Team B", result: "pending" });
  });

  it("counts totals from visible picks only, so no counter gives the hidden one away", async () => {
    const { alice, bob } = await aheadPickSetup();

    const mine = await getUserProfile(String(alice.userId), String(alice.userId));
    const theirs = await getUserProfile(String(alice.userId), String(bob.userId));

    // Two played weeks either way — the ahead pick moves nothing.
    expect(theirs!.stats.picksMade).toBe(2);
    expect(mine!.stats.picksMade).toBe(2);
    expect(theirs!.current!.teamsUsed).toBe(2);
    expect(mine!.current!.teamsUsed).toBe(2);
  });
});

describe("career record", () => {
  it("gathers games, wins and the best run across every game played", async () => {
    await seedTeams(6);
    const aliceId = await seedUser("Alice");
    const bobId = await seedUser("Bob");
    const finished = await seedGame({ status: "finished", startMatchday: 1, currentMatchday: 3 });
    const running = await seedGame({ status: "active", startMatchday: 1, currentMatchday: 2 });
    await entryFor(finished._id, aliceId, { status: "winner" });
    await entryFor(running._id, aliceId);

    const p = (await getUserProfile(String(aliceId), String(bobId)))!;

    expect(p.stats.gamesPlayed).toBe(2);
    expect(p.stats.wins).toBe(1);
    expect(p.stats.bestRun).toBe(2); // the game they won ran to matchday 3
    expect(p.stats.totalWeeksSurvived).toBe(3);
    expect(p.stats.averageWeeks).toBe(1.5);
    expect(p.current?.status).toBe("active");
    expect(p.past).toHaveLength(1);
    expect(p.past[0].entryStatus).toBe("winner");
  });

  it("reads weeks survived and the exit week off the elimination matchday", async () => {
    await seedTeams(6);
    const game = await seedGame({ startMatchday: 1, currentMatchday: 4 });
    const cara = await seedEntry(game._id, "Cara");
    const viewer = await seedEntry(game._id, "Viewer");
    await Entry.updateOne(
      { _id: cara.entry._id },
      { status: "eliminated", eliminatedAtMatchday: 2 }
    );

    const p = (await getUserProfile(String(cara.userId), String(viewer.userId)))!;

    expect(p.current!.survivedWeeks).toBe(1);
    expect(p.current!.eliminatedGameWeek).toBe(2);
    expect(p.current!.entryStatus).toBe("eliminated");
    // Still in beats out, so the viewer's live entry ranks above Cara's.
    expect(p.current!.rank).toBe(2);
    expect(p.current!.playersTotal).toBe(2);
  });

  it("totals picks, wildcards, auto-picks and the teams behind them", async () => {
    await seedTeams(6);
    const aliceId = await seedUser("Alice");
    const bobId = await seedUser("Bob");
    const finished = await seedGame({ status: "finished", startMatchday: 1, currentMatchday: 2 });
    const running = await seedGame({ status: "active", startMatchday: 1, currentMatchday: 2 });
    const out = await entryFor(finished._id, aliceId, {
      status: "eliminated",
      eliminatedAtMatchday: 2,
    });
    const live = await entryFor(running._id, aliceId);

    const pick = (
      gameId: Types.ObjectId,
      entryId: Types.ObjectId,
      matchday: number,
      teamApiId: number,
      extra: { result?: PickResult; autoPicked?: boolean; isWildcard?: boolean } = {}
    ) => seedPick({ gameId, entryId, userId: aliceId, matchday, teamApiId, ...extra });

    await pick(finished._id, out._id, 1, 1, { result: "win" });
    await pick(finished._id, out._id, 2, 2, { result: "loss", autoPicked: true });
    await pick(running._id, live._id, 1, 1, { result: "win", isWildcard: true });
    await pick(running._id, live._id, 2, 3, { result: "pending" });

    const { stats } = (await getUserProfile(String(aliceId), String(bobId)))!;

    expect(stats.picksMade).toBe(4);
    expect(stats.won).toBe(2);
    expect(stats.lost).toBe(1);
    expect(stats.drawn).toBe(0);
    expect(stats.winRate).toBe(67); // pending picks aren't decided yet
    expect(stats.wildcardsPlayed).toBe(1);
    expect(stats.autoPicks).toBe(1);
    expect(stats.favouriteTeam).toMatchObject({ name: "Team A", count: 2 });
    // The team they were on when they went out.
    expect(stats.nemesisTeam).toMatchObject({ name: "Team B", count: 1 });
  });

  it("reports an empty record for a player who hasn't joined a game", async () => {
    const aliceId = await seedUser("Alice");
    const bobId = await seedUser("Bob");

    const p = (await getUserProfile(String(aliceId), String(bobId)))!;

    expect(p.name).toBe("Alice T."); // never the full surname to another player
    expect(p.isSelf).toBe(false);
    expect(p.current).toBeNull();
    expect(p.past).toEqual([]);
    expect(p.stats.gamesPlayed).toBe(0);
    expect(p.headToHead).toBeNull();
  });

  it("gives the player their own full name", async () => {
    const aliceId = await seedUser("Alice");

    const p = (await getUserProfile(String(aliceId), String(aliceId)))!;

    expect(p.name).toBe("Alice Tester");
    expect(p.isSelf).toBe(true);
  });

  it("returns null for an unknown or malformed id", async () => {
    const viewerId = await seedUser("Viewer");

    expect(await getUserProfile("not-an-id", String(viewerId))).toBeNull();
    expect(await getUserProfile(String(new Types.ObjectId()), String(viewerId))).toBeNull();
  });
});

describe("head to head", () => {
  it("counts who outlasted whom in the games they've both played", async () => {
    await seedTeams(6);
    const game = await seedGame({ startMatchday: 1, currentMatchday: 5 });
    const aliceId = await seedUser("Alice");
    const bobId = await seedUser("Bob");
    await entryFor(game._id, aliceId, { status: "eliminated", eliminatedAtMatchday: 2 });
    await entryFor(game._id, bobId, { status: "eliminated", eliminatedAtMatchday: 4 });

    const p = (await getUserProfile(String(aliceId), String(bobId)))!;

    expect(p.headToHead).toEqual({
      gamesShared: 1,
      viewerAhead: 1,
      profileAhead: 0,
      level: 0,
    });
  });

  it("has nothing to say when the two have never shared a game", async () => {
    await seedTeams(6);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const strangerId = await seedUser("Stranger");

    const p = (await getUserProfile(String(alice.userId), String(strangerId)))!;

    expect(p.headToHead).toBeNull();
  });

  it("never compares a player with themselves", async () => {
    await seedTeams(6);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");

    const p = (await getUserProfile(String(alice.userId), String(alice.userId)))!;

    expect(p.headToHead).toBeNull();
  });
});
