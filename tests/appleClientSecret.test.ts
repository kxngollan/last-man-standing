import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { generateKeyPair, exportPKCS8, decodeJwt, decodeProtectedHeader, jwtVerify } from "jose";
import { getAppleClientSecret, resetAppleClientSecretCache } from "@/lib/apple/clientSecret";
import { AppleClientSecret } from "@/models/AppleClientSecret";
import { initDb, clearDb, closeDb } from "./helpers";

const CLIENT_ID = "com.example.lastmanstanding.web";
const DAY = 24 * 60 * 60 * 1000;

let publicKey: CryptoKey;
let privateKeyPem: string;

beforeAll(async () => {
  await initDb();
  // A throwaway .p8 in the shape Apple issues, so the signing path is real.
  const pair = await generateKeyPair("ES256", { extractable: true });
  publicKey = pair.publicKey;
  privateKeyPem = await exportPKCS8(pair.privateKey);
});

afterAll(closeDb);

beforeEach(async () => {
  await clearDb();
  // Otherwise the previous test's secret answers the next one.
  resetAppleClientSecretCache();
  // Restored every time: several tests below rotate these deliberately, and a
  // leaked rotation would silently change what the next test is testing.
  process.env.APPLE_TEAM_ID = "TEAM123456";
  process.env.APPLE_KEY_ID = "KEY1234567";
  process.env.APPLE_PRIVATE_KEY = privateKeyPem;
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
    // Stand in for another instance having written the row: mint once so the
    // fingerprint is a real one, then swap the secret underneath. Writing the
    // row by hand wouldn't do — a row with no fingerprint is deliberately
    // treated as stale, which is its own test below.
    await getAppleClientSecret(CLIENT_ID);
    await AppleClientSecret.updateOne(
      { clientId: CLIENT_ID },
      { $set: { secret: "minted-elsewhere" } }
    );
    resetAppleClientSecretCache();

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

  it("re-mints when the signing key has been rotated under it", async () => {
    const first = await getAppleClientSecret(CLIENT_ID);
    resetAppleClientSecretCache();

    // A new .p8, same key id — the case metadata alone would miss.
    const replacement = await generateKeyPair("ES256", { extractable: true });
    process.env.APPLE_PRIVATE_KEY = await exportPKCS8(replacement.privateKey);

    const second = await getAppleClientSecret(CLIENT_ID);

    expect(second).not.toBe(first);
    // Verifiable with the new key, not the old one: the stored secret really
    // was replaced rather than reused.
    await expect(jwtVerify(second, replacement.publicKey)).resolves.toBeTruthy();
    await expect(jwtVerify(second, publicKey)).rejects.toThrow();
    expect((await AppleClientSecret.findOne({ clientId: CLIENT_ID }).lean())?.secret).toBe(second);
  });

  it("re-mints when the key id changes", async () => {
    const first = await getAppleClientSecret(CLIENT_ID);
    resetAppleClientSecretCache();
    process.env.APPLE_KEY_ID = "DIFFERENT7";

    const second = await getAppleClientSecret(CLIENT_ID);

    expect(second).not.toBe(first);
    expect(decodeProtectedHeader(second).kid).toBe("DIFFERENT7");
  });

  it("re-mints when the team id changes", async () => {
    const first = await getAppleClientSecret(CLIENT_ID);
    resetAppleClientSecretCache();
    process.env.APPLE_TEAM_ID = "OTHERTEAM1";

    expect(await getAppleClientSecret(CLIENT_ID)).not.toBe(first);
  });

  it("replaces a row written before fingerprints were recorded", async () => {
    // Exactly the deployment that has a secret Apple rejects and an
    // environment that looks correct.
    await AppleClientSecret.create({
      clientId: CLIENT_ID,
      secret: "signed-with-who-knows-what",
      expiresAt: new Date(Date.now() + 20 * DAY),
    });

    const secret = await getAppleClientSecret(CLIENT_ID);

    expect(secret).not.toBe("signed-with-who-knows-what");
    await expect(jwtVerify(secret, publicKey)).resolves.toBeTruthy();
  });

  it("does not re-mint while the signing key is unchanged", async () => {
    const first = await getAppleClientSecret(CLIENT_ID);
    resetAppleClientSecretCache();

    expect(await getAppleClientSecret(CLIENT_ID)).toBe(first);
    expect(await AppleClientSecret.countDocuments()).toBe(1);
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
