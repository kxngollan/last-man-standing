import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { generateKeyPair, exportPKCS8, decodeJwt, decodeProtectedHeader, jwtVerify } from "jose";
import { getAppleClientSecret, resetAppleClientSecretCache } from "@/lib/apple/clientSecret";
import { AppleClientSecret } from "@/models/AppleClientSecret";
import { initDb, clearDb, closeDb } from "./helpers";

const CLIENT_ID = "com.example.lastmanstanding.web";
const DAY = 24 * 60 * 60 * 1000;

let publicKey: CryptoKey;

beforeAll(async () => {
  await initDb();
  // A throwaway .p8 in the shape Apple issues, so the signing path is real.
  const pair = await generateKeyPair("ES256", { extractable: true });
  publicKey = pair.publicKey;
  process.env.APPLE_TEAM_ID = "TEAM123456";
  process.env.APPLE_KEY_ID = "KEY1234567";
  process.env.APPLE_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
});

afterAll(closeDb);

beforeEach(async () => {
  await clearDb();
  // Otherwise the previous test's secret answers the next one.
  resetAppleClientSecretCache();
});

describe("getAppleClientSecret", () => {
  it("mints one and saves it when the database has none", async () => {
    const secret = await getAppleClientSecret(CLIENT_ID);

    const stored = await AppleClientSecret.findOne({ clientId: CLIENT_ID }).lean();
    expect(stored?.secret).toBe(secret);
    expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("signs it the way Apple expects", async () => {
    const secret = await getAppleClientSecret(CLIENT_ID);

    expect(decodeProtectedHeader(secret)).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    const { payload } = await jwtVerify(secret, publicKey, {
      issuer: "TEAM123456",
      audience: "https://appleid.apple.com",
    });
    // The Services ID goes in `sub` — Apple checks it against the client_id on
    // the token request.
    expect(payload.sub).toBe(CLIENT_ID);
  });

  it("reuses the stored one rather than minting a second", async () => {
    const first = await getAppleClientSecret(CLIENT_ID);
    resetAppleClientSecretCache();

    const second = await getAppleClientSecret(CLIENT_ID);

    expect(second).toBe(first);
    expect(await AppleClientSecret.countDocuments()).toBe(1);
  });

  it("reads the database, not just its own memory", async () => {
    // Written by some other instance, and never seen by this process.
    await AppleClientSecret.create({
      clientId: CLIENT_ID,
      secret: "minted-elsewhere",
      expiresAt: new Date(Date.now() + 20 * DAY),
    });

    expect(await getAppleClientSecret(CLIENT_ID)).toBe("minted-elsewhere");
  });

  it("replaces one that is about to expire", async () => {
    await AppleClientSecret.create({
      clientId: CLIENT_ID,
      secret: "nearly-spent",
      // Still valid, but inside the renewal window — a sign-in that starts now
      // could outlive it.
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });

    const secret = await getAppleClientSecret(CLIENT_ID);

    expect(secret).not.toBe("nearly-spent");
    const stored = await AppleClientSecret.findOne({ clientId: CLIENT_ID }).lean();
    expect(stored?.secret).toBe(secret);
    // Replaced in place — one client ID, one row.
    expect(await AppleClientSecret.countDocuments()).toBe(1);
  });

  it("keeps a second client's secret separate", async () => {
    const web = await getAppleClientSecret(CLIENT_ID);
    const app = await getAppleClientSecret("com.example.lastmanstanding.ios");

    expect(app).not.toBe(web);
    expect(decodeJwt(app).sub).toBe("com.example.lastmanstanding.ios");
    expect(await AppleClientSecret.countDocuments()).toBe(2);
  });

  it("refuses to mint without a signing key", async () => {
    const key = process.env.APPLE_PRIVATE_KEY;
    delete process.env.APPLE_PRIVATE_KEY;
    try {
      await expect(getAppleClientSecret(CLIENT_ID)).rejects.toThrow(/APPLE_PRIVATE_KEY/);
    } finally {
      process.env.APPLE_PRIVATE_KEY = key;
    }
  });

  it("still serves a stored secret when the signing key is missing", async () => {
    await AppleClientSecret.create({
      clientId: CLIENT_ID,
      secret: "minted-before-the-key-went-away",
      expiresAt: new Date(Date.now() + 20 * DAY),
    });

    const key = process.env.APPLE_PRIVATE_KEY;
    delete process.env.APPLE_PRIVATE_KEY;
    try {
      expect(await getAppleClientSecret(CLIENT_ID)).toBe("minted-before-the-key-went-away");
    } finally {
      process.env.APPLE_PRIVATE_KEY = key;
    }
  });

  it("accepts a key pasted in without its PEM header", async () => {
    const pem = process.env.APPLE_PRIVATE_KEY!;
    process.env.APPLE_PRIVATE_KEY = pem
      .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
      .replace(/\s+/g, "");
    try {
      const secret = await getAppleClientSecret(CLIENT_ID);
      await expect(jwtVerify(secret, publicKey)).resolves.toBeTruthy();
    } finally {
      process.env.APPLE_PRIVATE_KEY = pem;
    }
  });
});
