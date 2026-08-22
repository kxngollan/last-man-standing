import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

// The transport itself is out of scope here — what matters is who gets told
// what, and that nobody gets told twice.
const sent: Array<{ to: string; kind: string; gameWeek: number; teamName?: string | null }> = [];
vi.mock("@/lib/email", () => ({
  sendResultEmail: vi.fn(async (to: string, _link: string, opts: Record<string, unknown>) => {
    sent.push({ to, kind: String(opts.kind), gameWeek: Number(opts.gameWeek), teamName: opts.teamName as string | null });
  }),
}));

import { notifyMatchdayResults } from "@/lib/game/notify";
import { resolveMatchday, unresolveMatchday } from "@/lib/game/resolve";
import { Game } from "@/models/Game/Game";
import { Entry } from "@/models/Game/Entry";
import { User } from "@/models/User/User";
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
  future,
} from "./helpers";

beforeAll(initDb);
afterAll(closeDb);
beforeEach(async () => {
  await clearDb();
  sent.length = 0;
});

/** A resolved week 1: Alice and Cara through, Bob out. */
async function playWeekOne() {
  await seedTeams(6);
  const game = await seedGame();
  const alice = await seedEntry(game._id, "Alice");
  const bob = await seedEntry(game._id, "Bob");
  const cara = await seedEntry(game._id, "Cara");
  await seedFixtures(1, [
    { home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" },
    { home: 3, away: 4, status: "FINISHED", winner: "HOME_TEAM" },
  ]);
  await seedFixtures(2, [{ home: 5, away: 6, kickoff: future(), status: "TIMED" }]);
  await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
  await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0) });
  await seedPick({ gameId: game._id, entryId: cara.entry._id, userId: cara.userId, matchday: 1, teamApiId: 3, fixtureApiId: fixtureApiId(1, 1) });
  await resolveMatchday(String(game._id));
  return { game, alice, bob, cara };
}

const kindFor = (email: string) => sent.find((s) => s.to === email)?.kind;

describe("notifyMatchdayResults", () => {
  it("tells survivors they're through and the knocked-out player they're out", async () => {
    const { game } = await playWeekOne();

    const result = await notifyMatchdayResults(String(game._id));
    expect(result).toMatchObject({ matchday: 1, gameWeek: 1, sent: 3, failed: 0, remaining: 0 });

    expect(sent).toHaveLength(3);
    expect(kindFor("alice@example.com")).toBe("through");
    expect(kindFor("cara@example.com")).toBe("through");
    expect(kindFor("bob@example.com")).toBe("out");
    // The team they had on it makes the email, so it has to reach the sender.
    expect(sent.find((s) => s.to === "bob@example.com")?.teamName).toBe("Team B");
  });

  it("never tells the same player twice", async () => {
    const { game } = await playWeekOne();
    await notifyMatchdayResults(String(game._id));
    sent.length = 0;

    const again = await notifyMatchdayResults(String(game._id));
    expect(again).toMatchObject({ sent: 0, skipped: 3 });
    expect(sent).toHaveLength(0);
  });

  it("skips a player eliminated in an earlier week — they've already heard", async () => {
    const { game, cara } = await playWeekOne();
    await notifyMatchdayResults(String(game._id)); // week 1: all three told
    sent.length = 0;

    // Week 2 resolves: Cara goes out, Alice goes through. Bob went out in
    // week 1 and is no longer part of the conversation.
    await Entry.updateOne(
      { _id: cara.entry._id },
      { $set: { status: "eliminated", eliminatedAtMatchday: 2 } }
    );
    await Game.updateOne({ _id: game._id }, { $set: { currentMatchday: 3 } });

    const result = await notifyMatchdayResults(String(game._id));
    expect(result).toMatchObject({ matchday: 2, gameWeek: 2, sent: 2 });
    expect(sent.map((s) => s.to).sort()).toEqual(["alice@example.com", "cara@example.com"]);
    expect(kindFor("alice@example.com")).toBe("through");
    expect(kindFor("cara@example.com")).toBe("out");
  });

  it("congratulates the winner of a game the resolution finished", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const alice = await seedEntry(game._id, "Alice");
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);
    await seedPick({ gameId: game._id, entryId: alice.entry._id, userId: alice.userId, matchday: 1, teamApiId: 1, fixtureApiId: fixtureApiId(1, 0) });
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0) });
    await resolveMatchday(String(game._id));

    const result = await notifyMatchdayResults(String(game._id));
    expect(result).toMatchObject({ matchday: 1, sent: 2 });
    expect(kindFor("alice@example.com")).toBe("winner");
    expect(kindFor("bob@example.com")).toBe("out");
  });

  it("says nobody won when the week took the whole field", async () => {
    await seedTeams(2);
    const game = await seedGame();
    const bob = await seedEntry(game._id, "Bob");
    await seedFixtures(1, [{ home: 1, away: 2, status: "FINISHED", winner: "HOME_TEAM" }]);
    await seedPick({ gameId: game._id, entryId: bob.entry._id, userId: bob.userId, matchday: 1, teamApiId: 2, fixtureApiId: fixtureApiId(1, 0) });

    const resolved = await resolveMatchday(String(game._id));
    expect(resolved.outcome).toBe("all-out");

    await notifyMatchdayResults(String(game._id));
    expect(kindFor("bob@example.com")).toBe("all-out");
  });

  it("writes to no banned account", async () => {
    const { game, bob } = await playWeekOne();
    await User.updateOne({ _id: bob.userId }, { $set: { banned: true } });

    const result = await notifyMatchdayResults(String(game._id));
    expect(result).toMatchObject({ sent: 2, skipped: 1 });
    expect(kindFor("bob@example.com")).toBeUndefined();
  });

  it("re-notifies after an undo, so a corrected week gets the truth", async () => {
    const { game, bob } = await playWeekOne();
    await notifyMatchdayResults(String(game._id));
    expect(kindFor("bob@example.com")).toBe("out");
    sent.length = 0;

    await unresolveMatchday(String(game._id));
    expect((await Entry.findById(bob.entry._id))?.resultEmailedMatchday).toBeNull();

    // Week 1 goes round again, so its verdict is sent again.
    await resolveMatchday(String(game._id));
    const result = await notifyMatchdayResults(String(game._id));
    expect(result).toMatchObject({ matchday: 1, sent: 3 });
    expect(kindFor("bob@example.com")).toBe("out");
    expect(kindFor("alice@example.com")).toBe("through");
  });

  it("refuses when no week has been resolved yet", async () => {
    const game = await seedGame();
    await expect(notifyMatchdayResults(String(game._id))).rejects.toThrow(/no game week/i);
  });

  it("refuses a game still in registration", async () => {
    const game = await seedGame({ status: "registration" });
    await expect(notifyMatchdayResults(String(game._id))).rejects.toThrow(/hasn’t started/i);
  });
});
