import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it } from "vitest";
import { signInWithOAuth, type OAuthIdentity } from "@/lib/oauth";
import { setDateOfBirth, changeOwnPassword } from "@/lib/account";
import { attemptLogin } from "@/lib/login";
import { hashPassword } from "@/lib/password";
import { User } from "@/models/User/User";
import { UserReferralHandle } from "@/models/User/UserReferralHandle";
import { UserReferredBy } from "@/models/User/UserReferredBy";
import { encodeReferralCookie } from "@/lib/referral";
import { initDb, clearDb, closeDb, seedUser } from "./helpers";

beforeAll(initDb);
afterAll(closeDb);
beforeEach(clearDb);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

function google(overrides: Partial<OAuthIdentity> = {}): OAuthIdentity {
  return {
    provider: "google",
    providerAccountId: "google-sub-1",
    email: "Player@Example.com",
    emailVerified: true,
    firstName: "Sam",
    lastName: "Kerr",
    ...overrides,
  };
}

describe("signing in with Google/Apple", () => {
  it("creates a verified account, and holds it for a date of birth", async () => {
    const result = await signInWithOAuth(google());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.created).toBe(true);
    // Nothing to play with until /welcome has run.
    expect(result.user.needsOnboarding).toBe(true);

    const user = await User.findById(result.user.id);
    expect(user?.email).toBe("player@example.com"); // normalised
    expect(user?.name).toBe("Sam Kerr");
    // The provider proved the inbox, so there's nothing left to confirm.
    expect(user?.emailVerified).toBe(true);
    expect(user?.passwordHash).toBeUndefined();
    expect(user?.dob).toBeUndefined();
    expect(user?.oauthAccounts).toEqual([
      expect.objectContaining({ provider: "google", providerAccountId: "google-sub-1" }),
    ]);
  });

  it("signs the same identity back in without making a second account", async () => {
    const first = await signInWithOAuth(google());
    const second = await signInWithOAuth(google());
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.user.id).toBe(first.user.id);
    expect(second.created).toBe(false);
    expect(await User.countDocuments({})).toBe(1);
  });

  it("follows the subject id when the address at the provider changes", async () => {
    const first = await signInWithOAuth(google());
    const second = await signInWithOAuth(google({ email: "moved@example.com" }));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.user.id).toBe(first.user.id);
    expect(await User.countDocuments({})).toBe(1);
  });

  it("links to the password account with the same address", async () => {
    const userId = await seedUser("Linker");
    const result = await signInWithOAuth(
      google({ email: "linker@example.com", providerAccountId: "google-sub-2" })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.user.id).toBe(String(userId));
    expect(result.created).toBe(false);
    // Seeded accounts have a date of birth, so there's no onboarding to do.
    expect(result.user.needsOnboarding).toBe(false);
    expect(await User.countDocuments({})).toBe(1);

    // The password still works — linking adds a door, it doesn't close one.
    const user = await User.findById(userId);
    expect(user?.passwordHash).toBeTruthy();
  });

  it("settles a sign-up that never confirmed its email, and applies the admin allowlist", async () => {
    const userId = await seedUser("Pending");
    await User.updateOne({ _id: userId }, { $set: { emailVerified: false } });
    await UserReferredBy.create({
      userId,
      referrerUserId: await seedUser("Sender"),
      handleUsed: "sender",
      confirmed: false,
    });
    process.env.ADMIN_EMAILS = "pending@example.com";

    const result = await signInWithOAuth(
      google({ email: "pending@example.com", providerAccountId: "google-sub-3" })
    );
    expect(result.ok).toBe(true);

    const user = await User.findById(userId);
    expect(user?.emailVerified).toBe(true);
    // Same proof of inbox ownership the confirmation link gives.
    expect(user?.isAdmin).toBe(true);
    expect((await UserReferredBy.findOne({ userId }))?.confirmed).toBe(true);
  });

  it("refuses an address the provider hasn't verified", async () => {
    await seedUser("Victim");
    const result = await signInWithOAuth(
      google({ email: "victim@example.com", emailVerified: false })
    );

    expect(result).toEqual({ ok: false, reason: "unverified-email" });
    // The account it was aiming at is untouched.
    const user = await User.findOne({ email: "victim@example.com" });
    expect(user?.oauthAccounts).toBeUndefined();
  });

  it("refuses an identity with no email or no subject id", async () => {
    expect(await signInWithOAuth(google({ email: null }))).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(await signInWithOAuth(google({ providerAccountId: "" }))).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("credits the referrer whose link brought them in", async () => {
    const referrerId = await seedUser("Ref");
    const cookie = encodeReferralCookie(String(referrerId), "ref");

    const result = await signInWithOAuth(google(), cookie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await UserReferredBy.findOne({ userId: result.user.id });
    expect(row?.referrerUserId?.toString()).toBe(String(referrerId));
    // Verified from the start, so the referral counts immediately.
    expect(row?.confirmed).toBe(true);
    // And they get a link of their own.
    expect(await UserReferralHandle.findOne({ userId: result.user.id })).not.toBeNull();
  });

  it("names the account after the email when the provider sends no name", async () => {
    // What Apple does after the first consent: no name, so its provider config
    // passes the address through as one.
    const result = await signInWithOAuth({
      provider: "apple",
      providerAccountId: "apple-sub-1",
      email: "keeper@example.com",
      emailVerified: true,
      name: "keeper@example.com",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.name).toBe("keeper");
  });

  it("can link both providers to one account", async () => {
    const first = await signInWithOAuth(google());
    const second = await signInWithOAuth({
      provider: "apple",
      providerAccountId: "apple-sub-2",
      email: "player@example.com",
      emailVerified: true,
      name: "Sam Kerr",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.user.id).toBe(first.user.id);
    const user = await User.findById(first.user.id);
    expect(user?.oauthAccounts).toHaveLength(2);
  });

  it("won't let one provider identity claim two accounts", async () => {
    await signInWithOAuth(google());
    // Same subject id, a different address that already has an account.
    await seedUser("Other");
    const result = await signInWithOAuth(
      google({ email: "other@example.com", providerAccountId: "google-sub-1" })
    );
    // It found the identity's real owner rather than the address's.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.email).toBe("player@example.com");
  });
});

describe("an account with no password", () => {
  it("can't be logged into with one", async () => {
    const created = await signInWithOAuth(google());
    expect(created.ok).toBe(true);

    const result = await attemptLogin("player@example.com", "anything-at-all", "1.2.3.4");
    expect(result).toEqual({ ok: false, reason: "bad-credentials" });
  });

  it("is told to use the reset flow rather than the change-password form", async () => {
    const created = await signInWithOAuth(google());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await changeOwnPassword(created.user.id, "guess", "new-password-1")).toBe(
      "no-password"
    );
  });

  it("still lets an account that has a password change it", async () => {
    const userId = await seedUser("Haspass");
    await User.updateOne(
      { _id: userId },
      { $set: { passwordHash: await hashPassword("old-password") } }
    );
    expect(await changeOwnPassword(String(userId), "old-password", "new-password-1")).toBe("ok");
  });
});

describe("the date of birth /welcome collects", () => {
  it("saves once and lifts the onboarding flag", async () => {
    const created = await signInWithOAuth(google());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await setDateOfBirth(created.user.id, new Date("1990-05-01"))).toBe("ok");

    const again = await signInWithOAuth(google());
    expect(again.ok && again.user.needsOnboarding).toBe(false);
  });

  it("is still owed when the same account logs in with a password", async () => {
    // A Google account that gave itself a password through the reset flow
    // before it ever saw /welcome. The password login has to carry the same
    // claim, or it would be five minutes inside the portal before the session
    // re-reads and notices.
    const created = await signInWithOAuth(google());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await User.updateOne(
      { _id: created.user.id },
      { $set: { passwordHash: await hashPassword("set-by-reset") } }
    );

    const result = await attemptLogin("player@example.com", "set-by-reset", "1.2.3.4");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.needsOnboarding).toBe(true);
  });

  it("refuses anyone under 16", async () => {
    const created = await signInWithOAuth(google());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const twelve = new Date();
    twelve.setFullYear(twelve.getFullYear() - 12);
    expect(await setDateOfBirth(created.user.id, twelve)).toBe("too-young");
    expect((await User.findById(created.user.id))?.dob).toBeUndefined();
  });

  it("can't be changed once it's set", async () => {
    const userId = await seedUser("Fixed");
    expect(await setDateOfBirth(String(userId), new Date("1980-01-01"))).toBe("already-set");
    expect((await User.findById(userId))?.dob).toEqual(new Date("1990-01-01"));
  });
});
