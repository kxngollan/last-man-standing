import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { User } from "@/models/User/User";
import { UserReferredBy } from "@/models/User/UserReferredBy";
import {
  confirmReferral,
  encodeReferralCookie,
  ensureReferralHandle,
  getReferralBoard,
  parseReferralCookie,
  recordReferral,
  referralCount,
  resolveHandle,
  setReferralHandle,
  validateHandle,
} from "@/lib/referral";
import { initDb, clearDb, closeDb, seedUser } from "./helpers";

beforeAll(initDb);
afterAll(closeDb);
beforeEach(clearDb);

/** A referred player: signed up through `referrer`'s link, not yet confirmed. */
async function referBy(referrerId: Types.ObjectId, newName: string) {
  const handle = await ensureReferralHandle(String(referrerId));
  const newUserId = await seedUser(newName);
  await recordReferral(String(newUserId), encodeReferralCookie(String(referrerId), handle));
  return newUserId;
}

describe("handles", () => {
  it("defaults to the player's own id, so a link works from day one", async () => {
    const userId = await seedUser("Alice");

    const handle = await ensureReferralHandle(String(userId));

    expect(handle).toBe(String(userId).toLowerCase());
    expect(await resolveHandle(handle)).toBe(String(userId));
  });

  it("is stable — asking twice doesn't mint a second one", async () => {
    const userId = await seedUser("Alice");

    const first = await ensureReferralHandle(String(userId));
    const second = await ensureReferralHandle(String(userId));

    expect(second).toBe(first);
  });

  it("resolves an id link for an account that predates the feature", async () => {
    // No handle row has ever been written for this user.
    const userId = await seedUser("Alice");

    expect(await resolveHandle(String(userId))).toBe(String(userId));
  });

  it("retires the id link once that player picks a handle", async () => {
    const userId = await seedUser("Alice");
    await setReferralHandle(String(userId), "alice-fc");

    expect(await resolveHandle(String(userId))).toBeNull();
  });

  it("resolves nothing for an id-shaped string with no account behind it", async () => {
    expect(await resolveHandle(String(new Types.ObjectId()))).toBeNull();
  });

  it("refuses an id-shaped string as a custom handle", async () => {
    const userId = await seedUser("Alice");
    const otherId = new Types.ObjectId();

    expect(validateHandle(String(otherId))).toBe("id-shaped");
    expect(await setReferralHandle(String(userId), String(otherId))).toBe("id-shaped");
  });

  it("stops resolving the old id once a custom handle is set", async () => {
    const userId = await seedUser("Alice");
    const original = await ensureReferralHandle(String(userId));

    expect(await setReferralHandle(String(userId), "alice-fc")).toBe("ok");

    expect(await resolveHandle("alice-fc")).toBe(String(userId));
    // The link they shared before renaming is dead — and because id-shaped
    // strings can never be claimed, nobody else can pick it up either.
    expect(await resolveHandle(original)).toBeNull();
  });

  it("frees a released custom handle for someone else to claim", async () => {
    const alice = await seedUser("Alice");
    const bob = await seedUser("Bob");
    await setReferralHandle(String(alice), "striker");

    await setReferralHandle(String(alice), "keeper");

    expect(await setReferralHandle(String(bob), "striker")).toBe("ok");
    expect(await resolveHandle("striker")).toBe(String(bob));
  });

  it("won't let two players hold the same handle at once", async () => {
    const alice = await seedUser("Alice");
    const bob = await seedUser("Bob");
    await ensureReferralHandle(String(bob));
    expect(await setReferralHandle(String(alice), "striker")).toBe("ok");

    expect(await setReferralHandle(String(bob), "striker")).toBe("taken");
    expect(await resolveHandle("striker")).toBe(String(alice));
  });

  it("applies the format and reserved-word rules", async () => {
    expect(validateHandle("ab")).toBe("format"); // too short
    expect(validateHandle("a".repeat(31))).toBe("format");
    expect(validateHandle("-nope")).toBe("format");
    expect(validateHandle("nope-")).toBe("format");
    expect(validateHandle("no--pe")).toBe("format");
    expect(validateHandle("sp ace")).toBe("format");
    expect(validateHandle("admin")).toBe("reserved");
    expect(validateHandle("official")).toBe("reserved");
    expect(validateHandle("Alice-FC")).toBe("ok"); // case is normalised
  });

  it("stores handles lowercased so links aren't case-sensitive", async () => {
    const userId = await seedUser("Alice");

    await setReferralHandle(String(userId), "Alice-FC");

    expect(await resolveHandle("alice-fc")).toBe(String(userId));
    expect(await resolveHandle("ALICE-FC")).toBe(String(userId));
  });
});

describe("recording who referred whom", () => {
  it("credits the referrer by id, not by the handle they used", async () => {
    const alice = await seedUser("Alice");
    const bob = await referBy(alice, "Bob");

    const row = await UserReferredBy.findOne({ userId: bob }).lean();
    expect(String(row!.referrerUserId)).toBe(String(alice));
    expect(row!.confirmed).toBe(false);
  });

  it("keeps the credit when the referrer later changes their handle", async () => {
    const alice = await seedUser("Alice");
    const bob = await referBy(alice, "Bob");
    await confirmReferral(String(bob));

    // The whole reason attribution is stored by id.
    await setReferralHandle(String(alice), "alice-fc");

    expect(await referralCount(String(alice))).toBe(1);
    const row = await UserReferredBy.findOne({ userId: bob }).lean();
    expect(String(row!.referrerUserId)).toBe(String(alice));
  });

  it("ignores a self-referral", async () => {
    const alice = await seedUser("Alice");
    const handle = await ensureReferralHandle(String(alice));

    await recordReferral(String(alice), encodeReferralCookie(String(alice), handle));

    expect(await UserReferredBy.countDocuments({})).toBe(0);
  });

  it("ignores a cookie naming an account that no longer exists", async () => {
    const ghost = new Types.ObjectId();
    const bob = await seedUser("Bob");

    await recordReferral(String(bob), encodeReferralCookie(String(ghost), "ghost"));

    expect(await UserReferredBy.countDocuments({})).toBe(0);
  });

  it("ignores a missing or malformed cookie", async () => {
    const bob = await seedUser("Bob");

    await recordReferral(String(bob), undefined);
    await recordReferral(String(bob), "");
    await recordReferral(String(bob), "garbage");
    await recordReferral(String(bob), "not-an-id.handle");

    expect(await UserReferredBy.countDocuments({})).toBe(0);
    expect(parseReferralCookie("garbage")).toBeNull();
    expect(parseReferralCookie(null)).toBeNull();
  });

  it("claims a player once — a second link doesn't steal them", async () => {
    const alice = await seedUser("Alice");
    const carol = await seedUser("Carol");
    const bob = await referBy(alice, "Bob");

    const carolHandle = await ensureReferralHandle(String(carol));
    await recordReferral(String(bob), encodeReferralCookie(String(carol), carolHandle));

    const rows = await UserReferredBy.find({ userId: bob }).lean();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].referrerUserId)).toBe(String(alice));
  });
});

describe("counting and the leaderboard", () => {
  it("doesn't count a referral until the new player verifies their email", async () => {
    const alice = await seedUser("Alice");
    const bob = await referBy(alice, "Bob");

    expect(await referralCount(String(alice))).toBe(0);

    await confirmReferral(String(bob));

    expect(await referralCount(String(alice))).toBe(1);
  });

  it("ranks referrers by confirmed referrals and marks the viewer", async () => {
    const alice = await seedUser("Alice");
    const carol = await seedUser("Carol");
    for (const name of ["Bob", "Dan"]) {
      await confirmReferral(String(await referBy(alice, name)));
    }
    await confirmReferral(String(await referBy(carol, "Erin")));

    const board = await getReferralBoard(String(carol));

    expect(board.map((r) => [r.rank, r.name, r.count])).toEqual([
      [1, "Alice T.", 2],
      [2, "Carol T.", 1],
    ]);
    expect(board[1].you).toBe(true);
    expect(board[0].you).toBe(false);
  });

  it("leaves out unconfirmed referrals entirely", async () => {
    const alice = await seedUser("Alice");
    await referBy(alice, "Bob");

    expect(await getReferralBoard(String(alice))).toEqual([]);
  });

  it("drops players who opted out, and still counts them privately", async () => {
    const alice = await seedUser("Alice");
    await confirmReferral(String(await referBy(alice, "Bob")));
    await User.updateOne({ _id: alice }, { hideFromReferralBoard: true });

    expect(await getReferralBoard(String(alice))).toEqual([]);
    // Off the board, but they can still see their own total in settings.
    expect(await referralCount(String(alice))).toBe(1);
  });
});
