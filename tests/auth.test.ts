import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rateLimit";
import { createResetToken, resetPasswordWithToken } from "@/lib/passwordReset";
import { createVerificationToken, consumeVerificationToken } from "@/lib/verification";
import { POST as signUp } from "@/app/api/sign-up/route";
import { User } from "@/models/User";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { initDb, clearDb, closeDb, seedUser } from "./helpers";

beforeAll(initDb);
afterAll(closeDb);
beforeEach(clearDb);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("rateLimit", () => {
  it("allows up to the limit, then blocks within the window", async () => {
    for (let i = 0; i < 3; i++) expect(await rateLimit("t:a", 3, 60_000)).toBe(true);
    expect(await rateLimit("t:a", 3, 60_000)).toBe(false);
    // Other keys are unaffected.
    expect(await rateLimit("t:b", 3, 60_000)).toBe(true);
  });

  it("resets when the window rolls over", async () => {
    expect(await rateLimit("t:w", 1, 300)).toBe(true);
    expect(await rateLimit("t:w", 1, 300)).toBe(false);
    await sleep(350);
    expect(await rateLimit("t:w", 1, 300)).toBe(true);
  });

  it("enforces a zero limit from the first call", async () => {
    expect(await rateLimit("t:z", 0, 60_000)).toBe(false);
  });
});

describe("password reset tokens", () => {
  it("rotates: issuing a new token invalidates the previous one", async () => {
    const userId = await seedUser("Rota");
    const first = await createResetToken(String(userId));
    const second = await createResetToken(String(userId));

    expect(await resetPasswordWithToken(first, "new-password-1")).toBe("invalid");
    expect(await resetPasswordWithToken(second, "new-password-2")).toBe("ok");
    expect(await PasswordResetToken.countDocuments({ userId })).toBe(0);
  });

  it("a used token can't be replayed", async () => {
    const userId = await seedUser("Replay");
    const token = await createResetToken(String(userId));
    expect(await resetPasswordWithToken(token, "new-password-1")).toBe("ok");
    expect(await resetPasswordWithToken(token, "new-password-2")).toBe("invalid");
  });

  it("confirms the address and applies the admin allowlist", async () => {
    const userId = await seedUser("Resetter");
    await User.updateOne({ _id: userId }, { $set: { emailVerified: false } });
    process.env.ADMIN_EMAILS = "resetter@example.com";

    const token = await createResetToken(String(userId));
    expect(await resetPasswordWithToken(token, "new-password-1")).toBe("ok");

    const user = await User.findById(userId);
    expect(user?.emailVerified).toBe(true);
    expect(user?.isAdmin).toBe(true);
  });
});

describe("email verification", () => {
  it("verifies once, then the token is dead", async () => {
    const userId = await seedUser("Verify");
    await User.updateOne({ _id: userId }, { $set: { emailVerified: false } });

    const token = await createVerificationToken(String(userId));
    expect(await consumeVerificationToken(token)).toBe("verified");
    expect(await consumeVerificationToken(token)).toBe("invalid");
  });

  it("grants admin at verification when the address is allowlisted", async () => {
    const userId = await seedUser("Admin");
    await User.updateOne({ _id: userId }, { $set: { emailVerified: false } });
    process.env.ADMIN_EMAILS = "somebody@else.com, admin@example.com";

    const token = await createVerificationToken(String(userId));
    expect(await consumeVerificationToken(token)).toBe("verified");
    expect((await User.findById(userId))?.isAdmin).toBe(true);
  });
});

describe("sign-up route", () => {
  const req = (body: unknown, ip = "203.0.113.7") =>
    new Request("http://test/api/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify(body),
    });

  const validBody = (email: string) => ({
    firstName: "Pat",
    lastName: "Tester",
    email,
    password: "long-enough-pw",
    dob: "1990-01-01",
  });

  it("creates an unverified user — and never an admin, even for allowlisted emails", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const res = await signUp(req(validBody("boss@example.com")));
    expect(res.status).toBe(201);

    const user = await User.findOne({ email: "boss@example.com" });
    expect(user?.emailVerified).toBe(false);
    expect(user?.isAdmin).toBe(false); // promotion happens at verification
  });

  it("rejects a duplicate email with 409", async () => {
    expect((await signUp(req(validBody("dup@example.com")))).status).toBe(201);
    expect((await signUp(req(validBody("dup@example.com")))).status).toBe(409);
  });

  it("rejects a password longer than 72 characters", async () => {
    const res = await signUp(
      req({ ...validBody("long@example.com"), password: "x".repeat(73) })
    );
    expect(res.status).toBe(400);
  });

  it("rate limits per IP", async () => {
    const ip = "198.51.100.9";
    // Burn the 10/hour budget with cheap invalid bodies…
    for (let i = 0; i < 10; i++) {
      expect((await signUp(req({}, ip))).status).toBe(400);
    }
    // …then even a valid sign-up from that IP is refused.
    const res = await signUp(req(validBody("throttled@example.com"), ip));
    expect(res.status).toBe(429);
    // A different IP is unaffected.
    expect((await signUp(req(validBody("fine@example.com"), "198.51.100.10"))).status).toBe(201);
  });
});
