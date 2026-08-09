import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { User } from "@/models/User/User";
import { changeOwnPassword, renameUser, sessionOutlivedPassword } from "@/lib/account";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createResetToken, resetPasswordWithToken } from "@/lib/passwordReset";
import { initDb, clearDb, closeDb } from "./helpers";

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
