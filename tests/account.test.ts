import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { User } from "@/models/User/User";
import { PasswordResetToken } from "@/models/User/PasswordResetToken";
import { VerificationToken } from "@/models/User/VerificationToken";
import { UserReferralHandle } from "@/models/User/UserReferralHandle";
import { UserReferredBy } from "@/models/User/UserReferredBy";
import { Entry } from "@/models/Game/Entry";
import { Pick } from "@/models/Game/Pick";
import { Game } from "@/models/Game/Game";
import { Feedback } from "@/models/Report/Feedback";
import { IssueReport } from "@/models/Report/IssueReport";
import {
  changeOwnPassword,
  deleteOwnAccount,
  renameUser,
  sessionOutlivedPassword,
} from "@/lib/account";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createResetToken, resetPasswordWithToken } from "@/lib/passwordReset";
import { initDb, clearDb, closeDb, seedGame, seedUser } from "./helpers";

beforeAll(initDb);
afterAll(closeDb);
beforeEach(clearDb);

/** A verified account with a known password. */
async function seedAccount(password = "correct-horse") {
  const user = await User.create({
    name: "Alice Tester",
    firstName: "Alice",
    lastName: "Tester",
    email: "alice@example.com",
    passwordHash: await hashPassword(password),
    dob: new Date("1990-01-01"),
    emailVerified: true,
  });
  return user;
}

describe("changing your own password", () => {
  it("replaces the hash once the current password checks out", async () => {
    const user = await seedAccount();

    expect(await changeOwnPassword(String(user._id), "correct-horse", "battery-staple")).toBe("ok");

    const after = await User.findById(user._id).lean();
    expect(await verifyPassword("battery-staple", after!.passwordHash)).toBe(true);
    expect(await verifyPassword("correct-horse", after!.passwordHash)).toBe(false);
  });

  it("refuses a wrong current password and changes nothing", async () => {
    const user = await seedAccount();

    expect(await changeOwnPassword(String(user._id), "not-it", "battery-staple")).toBe(
      "wrong-password"
    );

    const after = await User.findById(user._id).lean();
    expect(await verifyPassword("correct-horse", after!.passwordHash)).toBe(true);
    // No stamp, so no other session gets kicked out by a failed guess.
    expect(after!.passwordChangedAt).toBeNull();
  });

  it("stamps passwordChangedAt so other sessions can be ended", async () => {
    const user = await seedAccount();
    const before = Date.now();

    await changeOwnPassword(String(user._id), "correct-horse", "battery-staple");

    const after = await User.findById(user._id).lean();
    expect(after!.passwordChangedAt).toBeInstanceOf(Date);
    expect(after!.passwordChangedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("reports an unknown or malformed account", async () => {
    expect(await changeOwnPassword("not-an-id", "a", "battery-staple")).toBe("unknown-user");
    expect(await changeOwnPassword(String(new Types.ObjectId()), "a", "battery-staple")).toBe(
      "unknown-user"
    );
  });
});

describe("session revocation rule", () => {
  it("leaves alone an account that has never changed its password", () => {
    expect(sessionOutlivedPassword(Date.now(), null)).toBe(false);
    expect(sessionOutlivedPassword(0, undefined)).toBe(false);
  });

  it("ends a session last refreshed before the change", () => {
    const changedAt = new Date("2026-01-01T12:00:00Z");
    const staleSession = new Date("2026-01-01T11:59:00Z").getTime();

    expect(sessionOutlivedPassword(staleSession, changedAt)).toBe(true);
  });

  it("keeps a session issued after the change — the device that made it", () => {
    const changedAt = new Date("2026-01-01T12:00:00Z");
    const freshSession = new Date("2026-01-01T12:00:01Z").getTime();

    expect(sessionOutlivedPassword(freshSession, changedAt)).toBe(false);
  });
});

describe("the forgot-password flow", () => {
  it("also stamps passwordChangedAt, so a reset drops an intruder's session", async () => {
    const user = await seedAccount();
    const token = await createResetToken(String(user._id));

    expect(await resetPasswordWithToken(token, "brand-new-password")).toBe("ok");

    const after = await User.findById(user._id).lean();
    expect(after!.passwordChangedAt).toBeInstanceOf(Date);
    expect(await verifyPassword("brand-new-password", after!.passwordHash)).toBe(true);
  });
});

describe("renaming yourself", () => {
  it("saves both halves and keeps the stored full name in step", async () => {
    const user = await seedAccount();

    const result = await renameUser(String(user._id), "  Alicia  ", " Keys ");

    expect(result).toEqual({ firstName: "Alicia", lastName: "Keys", name: "Alicia Keys" });
    const after = await User.findById(user._id).lean();
    // `name` is what the session and the standings read — it must not drift.
    expect(after!.name).toBe("Alicia Keys");
    expect(after!.firstName).toBe("Alicia");
  });

  it("splits a legacy account that only ever had `name`", async () => {
    const legacy = await User.create({
      name: "Old Account",
      email: "legacy@example.com",
      passwordHash: await hashPassword("whatever"),
      dob: new Date("1990-01-01"),
      emailVerified: true,
    });

    const result = await renameUser(String(legacy._id), "Sam", "Kerr");

    expect(result).toEqual({ firstName: "Sam", lastName: "Kerr", name: "Sam Kerr" });
  });

  it("returns null for an unknown or malformed account", async () => {
    expect(await renameUser("not-an-id", "A", "B")).toBeNull();
    expect(await renameUser(String(new Types.ObjectId()), "A", "B")).toBeNull();
  });
});

describe("deleting your own account", () => {
  /** An account with something in every collection that points at a user. */
  async function seedAccountWithEverything() {
    const user = await seedAccount();
    const userId = user._id;
    const game = await seedGame();
    const entry = await Entry.create({ gameId: game._id, userId, status: "alive" });

    await Pick.create({
      gameId: game._id,
      entryId: entry._id,
      userId,
      matchday: 1,
      teamApiId: 1,
      fixtureApiId: null,
      result: "pending",
    });
    await Feedback.create({ userId, message: "Nice game", rating: 5 });
    await IssueReport.create({ userId, category: "bug", message: "Something broke" });
    await PasswordResetToken.create({
      userId,
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await VerificationToken.create({
      userId,
      tokenHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await UserReferralHandle.create({ userId, referralHandle: "alice" });

    return { user, userId, game, entry };
  }

  it("removes the account and everything that pointed at it", async () => {
    const { userId } = await seedAccountWithEverything();

    expect(await deleteOwnAccount(String(userId))).toBe("ok");

    expect(await User.findById(userId).lean()).toBeNull();
    expect(await Entry.countDocuments({ userId })).toBe(0);
    expect(await Pick.countDocuments({ userId })).toBe(0);
    expect(await Feedback.countDocuments({ userId })).toBe(0);
    expect(await IssueReport.countDocuments({ userId })).toBe(0);
    expect(await PasswordResetToken.countDocuments({ userId })).toBe(0);
    expect(await VerificationToken.countDocuments({ userId })).toBe(0);
    expect(await UserReferralHandle.countDocuments({ userId })).toBe(0);
  });

  it("clears referral links in both directions", async () => {
    const user = await seedAccount();
    const invitee = await seedUser("Bob");
    const inviter = await seedUser("Carol");

    // They invited Bob, and Carol invited them.
    await UserReferredBy.create({
      userId: invitee,
      referrerUserId: user._id,
      handleUsed: "alice",
      confirmed: true,
    });
    await UserReferredBy.create({
      userId: user._id,
      referrerUserId: inviter,
      handleUsed: "carol",
      confirmed: true,
    });

    expect(await deleteOwnAccount(String(user._id))).toBe("ok");

    // Nothing may be left naming the deleted account, either way round.
    expect(await UserReferredBy.countDocuments({ referrerUserId: user._id })).toBe(0);
    expect(await UserReferredBy.countDocuments({ userId: user._id })).toBe(0);
    // The other two accounts are untouched.
    expect(await User.findById(invitee).lean()).not.toBeNull();
    expect(await User.findById(inviter).lean()).not.toBeNull();
  });

  it("keeps a game they won but drops the winner pointer", async () => {
    const user = await seedAccount();
    const game = await seedGame({ status: "finished", winnerUserId: user._id });

    expect(await deleteOwnAccount(String(user._id))).toBe("ok");

    // The game is other players' history too, so it stays — just without a
    // pointer to an account that no longer exists.
    const after = await Game.findById(game._id).lean();
    expect(after).not.toBeNull();
    expect(after!.winnerUserId).toBeNull();
  });

  it("leaves other players' picks and entries alone", async () => {
    const { userId } = await seedAccountWithEverything();
    const game = await seedGame();
    const otherId = await seedUser("Dave");
    const otherEntry = await Entry.create({ gameId: game._id, userId: otherId, status: "alive" });
    await Pick.create({
      gameId: game._id,
      entryId: otherEntry._id,
      userId: otherId,
      matchday: 1,
      teamApiId: 2,
      fixtureApiId: null,
      result: "pending",
    });

    await deleteOwnAccount(String(userId));

    expect(await Entry.countDocuments({ userId: otherId })).toBe(1);
    expect(await Pick.countDocuments({ userId: otherId })).toBe(1);
  });

  it("refuses an admin account rather than stranding the games they created", async () => {
    const admin = await User.create({
      name: "Admin Person",
      email: "admin@example.com",
      passwordHash: await hashPassword("whatever"),
      dob: new Date("1990-01-01"),
      emailVerified: true,
      isAdmin: true,
    });
    await seedGame({ createdBy: admin._id });

    expect(await deleteOwnAccount(String(admin._id))).toBe("is-admin");
    expect(await User.findById(admin._id).lean()).not.toBeNull();
  });

  it("reports an unknown or malformed account without throwing", async () => {
    expect(await deleteOwnAccount("not-an-id")).toBe("unknown-user");
    expect(await deleteOwnAccount(String(new Types.ObjectId()))).toBe("unknown-user");
  });
});
