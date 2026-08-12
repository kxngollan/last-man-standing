import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { encode } from "next-auth/jwt";
import { User } from "@/models/User/User";
import { hashPassword } from "@/lib/password";
import { attemptLogin } from "@/lib/login";
import { bearerFrom, issueMobileToken, userFromToken } from "@/lib/mobile/auth";
import { changeOwnPassword } from "@/lib/account";
import { initDb, clearDb, closeDb } from "./helpers";

// The token helpers derive their key from this.
process.env.AUTH_SECRET ??= "test-secret-for-mobile-tokens-0123456789";

beforeAll(initDb);
afterAll(closeDb);
beforeEach(clearDb);

async function seedAccount(opts: { password?: string; emailVerified?: boolean } = {}) {
  return User.create({
    name: "Alice Tester",
    firstName: "Alice",
    lastName: "Tester",
    email: "alice@example.com",
    passwordHash: await hashPassword(opts.password ?? "correct-horse"),
    dob: new Date("1990-01-01"),
    emailVerified: opts.emailVerified ?? true,
  });
}

const tokenFor = (user: { _id: unknown; name: string; email: string; isAdmin?: boolean }) =>
  issueMobileToken({
    id: String(user._id),
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin ?? false,
  });

describe("bearer header parsing", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers });

  it("reads a well-formed header, case-insensitively", () => {
    expect(bearerFrom(req({ authorization: "Bearer abc.def" }))).toBe("abc.def");
    expect(bearerFrom(req({ authorization: "bearer abc.def" }))).toBe("abc.def");
  });

  it("ignores anything that isn't a bearer token", () => {
    expect(bearerFrom(req({}))).toBeNull();
    expect(bearerFrom(req({ authorization: "Basic abc" }))).toBeNull();
    expect(bearerFrom(req({ authorization: "Bearer" }))).toBeNull();
    expect(bearerFrom(req({ authorization: "Bearer   " }))).toBeNull();
  });
});

describe("mobile tokens", () => {
  it("round-trips a user", async () => {
    const user = await seedAccount();
    const { token, expiresAt } = await tokenFor(user);

    const resolved = await userFromToken(token);

    expect(resolved).toMatchObject({ id: String(user._id), email: "alice@example.com" });
    // 30 days out, give or take the time the test took.
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
  });

  it("rejects a tampered or unparseable token", async () => {
    const user = await seedAccount();
    const { token } = await tokenFor(user);

    expect(await userFromToken(`${token}x`)).toBeNull();
    expect(await userFromToken("garbage")).toBeNull();
    expect(await userFromToken("")).toBeNull();
  });

  it("rejects a token minted with a different salt", async () => {
    // A web session cookie is the same JWT under a different salt. It must not
    // be replayable as a bearer token, or the two families become one.
    const user = await seedAccount();
    const foreign = await encode({
      token: { id: String(user._id), isAdmin: false },
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
      maxAge: 3600,
    });

    expect(await userFromToken(foreign)).toBeNull();
  });

  it("rejects a token for an account that has been deleted", async () => {
    const user = await seedAccount();
    const { token } = await tokenFor(user);
    await User.deleteOne({ _id: user._id });

    expect(await userFromToken(token)).toBeNull();
  });

  it("rejects a token for an unverified account", async () => {
    const user = await seedAccount({ emailVerified: false });
    const { token } = await tokenFor(user);

    expect(await userFromToken(token)).toBeNull();
  });

  it("dies when the password changes — phones aren't exempt from revocation", async () => {
    const user = await seedAccount({ password: "correct-horse" });
    const { token } = await tokenFor(user);
    expect(await userFromToken(token)).not.toBeNull();

    // A second must pass: the token's iat has whole-second resolution, so a
    // change in the same second is legitimately not "after" it.
    await new Promise((r) => setTimeout(r, 1100));
    await changeOwnPassword(String(user._id), "correct-horse", "battery-staple");

    expect(await userFromToken(token)).toBeNull();
  });
});

describe("shared login (the door mobile and web both use)", () => {
  it("accepts the right password and reports the user", async () => {
    const user = await seedAccount({ password: "correct-horse" });

    const result = await attemptLogin("ALICE@example.com ", "correct-horse", "1.1.1.1");

    expect(result).toEqual({
      ok: true,
      user: {
        id: String(user._id),
        name: "Alice Tester",
        email: "alice@example.com",
        isAdmin: false,
      },
    });
  });

  it("rejects a wrong password and a missing account alike", async () => {
    await seedAccount();

    expect(await attemptLogin("alice@example.com", "wrong", "1.1.1.2")).toEqual({
      ok: false,
      reason: "bad-credentials",
    });
    expect(await attemptLogin("nobody@example.com", "whatever", "1.1.1.3")).toEqual({
      ok: false,
      reason: "bad-credentials",
    });
  });

  it("reports an unconfirmed inbox distinctly, so the app can say so", async () => {
    await seedAccount({ emailVerified: false });

    expect(await attemptLogin("alice@example.com", "correct-horse", "1.1.1.4")).toEqual({
      ok: false,
      reason: "unverified",
    });
  });

  it("rejects malformed input before touching bcrypt", async () => {
    expect(await attemptLogin("not-an-email", "x", "1.1.1.5")).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(await attemptLogin("alice@example.com", "", "1.1.1.5")).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(await attemptLogin(undefined, undefined, "1.1.1.5")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rate-limits per email, so mobile can't be used to brute force", async () => {
    await seedAccount();

    // The per-email limit is 5 per 15 minutes. Vary the IP so it's provably
    // the email limit biting, not the per-IP one.
    for (let i = 0; i < 5; i++) {
      const r = await attemptLogin("alice@example.com", "wrong", `10.0.0.${i}`);
      expect(r).toEqual({ ok: false, reason: "bad-credentials" });
    }

    const blocked = await attemptLogin("alice@example.com", "correct-horse", "10.0.0.99");
    expect(blocked).toEqual({ ok: false, reason: "rate-limited" });
  });
});
