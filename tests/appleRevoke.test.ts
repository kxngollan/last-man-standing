import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, exportPKCS8 } from "jose";
import { deleteOwnAccount } from "@/lib/account";
import { signInWithOAuth, type OAuthIdentity } from "@/lib/oauth";
import { resetAppleClientSecretCache } from "@/lib/apple/clientSecret";
import { exchangeAppleCode } from "@/lib/apple/exchangeCode";
import { identityFromClaims } from "@/lib/mobile/socialToken";
import { User } from "@/models/User/User";
import { initDb, clearDb, closeDb } from "./helpers";

const SERVICES_ID = "com.footballlms.www";
const BUNDLE_ID = "com.footballlms";

beforeAll(async () => {
  await initDb();
  const pair = await generateKeyPair("ES256", { extractable: true });
  process.env.APPLE_TEAM_ID = "TEAM123456";
  process.env.APPLE_KEY_ID = "KEY1234567";
  process.env.APPLE_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
});

afterAll(closeDb);

beforeEach(async () => {
  await clearDb();
  resetAppleClientSecretCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Apple's revoke endpoint, stubbed. Returns the calls made to it. */
function stubApple(response: Response | Error = new Response(null, { status: 200 })) {
  const calls: Array<{ url: string; body: URLSearchParams }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, body: new URLSearchParams(String(init?.body ?? "")) });
    if (response instanceof Error) throw response;
    return response.clone();
  });
  return calls;
}

function apple(overrides: Partial<OAuthIdentity> = {}): OAuthIdentity {
  return {
    provider: "apple",
    providerAccountId: "apple-sub-1",
    email: "player@example.com",
    emailVerified: true,
    firstName: "Sam",
    lastName: "Kerr",
    refreshToken: "apple-refresh-token",
    clientId: SERVICES_ID,
    ...overrides,
  };
}

/** Sign in the way someone does after saying yes on the confirmation screen. */
function register(identity: OAuthIdentity) {
  return signInWithOAuth(identity, {
    consent: {
      provider: identity.provider,
      email: (identity.email ?? "").toLowerCase(),
      dob: "1990-05-01",
      parentalConsent: false,
    },
  });
}

describe("storing Apple credentials at sign-in", () => {
  it("keeps the refresh token and the client it belongs to", async () => {
    const result = await register(apple());
    expect(result.ok).toBe(true);

    const user = await User.findOne({ email: "player@example.com" }).lean();
    expect(user?.oauthAccounts?.[0]).toMatchObject({
      provider: "apple",
      providerAccountId: "apple-sub-1",
      refreshToken: "apple-refresh-token",
      clientId: SERVICES_ID,
    });
  });

  it("replaces it when the same account signs in again", async () => {
    await register(apple());
    await signInWithOAuth(apple({ refreshToken: "a-newer-token" }));

    const user = await User.findOne({ email: "player@example.com" }).lean();
    expect(user?.oauthAccounts?.[0].refreshToken).toBe("a-newer-token");
  });

  it("does not blank a stored token when a later sign-in brings none", async () => {
    await register(apple());
    // The app's second call carries an id token only — Apple hands out a
    // refresh token once per consent.
    await signInWithOAuth(apple({ refreshToken: null, clientId: null }));

    const user = await User.findOne({ email: "player@example.com" }).lean();
    expect(user?.oauthAccounts?.[0].refreshToken).toBe("apple-refresh-token");
  });

  it("stores nothing for Google", async () => {
    await register({
      provider: "google",
      providerAccountId: "google-sub-1",
      email: "other@example.com",
      emailVerified: true,
      refreshToken: "google-refresh-token",
      clientId: "google-client",
    });

    const user = await User.findOne({ email: "other@example.com" }).lean();
    expect(user?.oauthAccounts?.[0].refreshToken).toBeUndefined();
    expect(user?.oauthAccounts?.[0].clientId).toBeUndefined();
  });
});

describe("revoking at Apple on deletion", () => {
  it("tells Apple to forget the account", async () => {
    await register(apple());
    const user = await User.findOne({ email: "player@example.com" }).lean();
    const calls = stubApple();

    expect(await deleteOwnAccount(String(user!._id))).toBe("ok");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://appleid.apple.com/auth/revoke");
    expect(calls[0].body.get("token")).toBe("apple-refresh-token");
    expect(calls[0].body.get("token_type_hint")).toBe("refresh_token");
    // The client the token was issued to, and a secret signed for that same
    // client — the pairing Apple checks.
    expect(calls[0].body.get("client_id")).toBe(SERVICES_ID);
    expect(calls[0].body.get("client_secret")).toBeTruthy();
  });

  it("presents the bundle id for an account that signed in on the phone", async () => {
    await register(apple({ clientId: BUNDLE_ID }));
    const user = await User.findOne({ email: "player@example.com" }).lean();
    const calls = stubApple();

    await deleteOwnAccount(String(user!._id));

    expect(calls[0].body.get("client_id")).toBe(BUNDLE_ID);
  });

  it("leaves Google accounts alone", async () => {
    await register({
      provider: "google",
      providerAccountId: "google-sub-1",
      email: "other@example.com",
      emailVerified: true,
    });
    const user = await User.findOne({ email: "other@example.com" }).lean();
    const calls = stubApple();

    expect(await deleteOwnAccount(String(user!._id))).toBe("ok");
    expect(calls).toHaveLength(0);
  });

  it("still deletes the account when Apple refuses", async () => {
    await register(apple());
    const user = await User.findOne({ email: "player@example.com" }).lean();
    stubApple(new Response("invalid_grant", { status: 400 }));

    expect(await deleteOwnAccount(String(user!._id))).toBe("ok");
    expect(await User.findById(user!._id).lean()).toBeNull();
  });

  it("still deletes the account when Apple is unreachable", async () => {
    await register(apple());
    const user = await User.findOne({ email: "player@example.com" }).lean();
    stubApple(new Error("network down"));

    expect(await deleteOwnAccount(String(user!._id))).toBe("ok");
    expect(await User.findById(user!._id).lean()).toBeNull();
  });

  it("revokes with the client named in the id token the app sent", async () => {
    // The `aud` claim is where the bundle id comes from on the phone — the one
    // thing that says which client the code, and so the token, belongs to.
    const identity = identityFromClaims("apple", {
      sub: "apple-sub-1",
      email: "player@example.com",
      email_verified: true,
      aud: BUNDLE_ID,
    })!;
    await register({ ...identity, refreshToken: "from-the-phone" });
    const user = await User.findOne({ email: "player@example.com" }).lean();
    const calls = stubApple();

    await deleteOwnAccount(String(user!._id));

    expect(calls[0].body.get("client_id")).toBe(BUNDLE_ID);
    expect(calls[0].body.get("token")).toBe("from-the-phone");
  });

  it("skips an Apple account stored before tokens were kept", async () => {
    const user = await User.create({
      name: "Old Timer",
      firstName: "Old",
      lastName: "Timer",
      email: "old@example.com",
      dob: new Date("1990-01-01"),
      emailVerified: true,
      oauthAccounts: [{ provider: "apple", providerAccountId: "apple-sub-old" }],
    });
    const calls = stubApple();

    expect(await deleteOwnAccount(String(user._id))).toBe("ok");
    expect(calls).toHaveLength(0);
  });
});

describe("exchanging the app's authorization code", () => {
  it("asks Apple for a refresh token", async () => {
    const calls = stubApple(
      Response.json({ access_token: "at", refresh_token: "rt-from-apple", expires_in: 3600 })
    );

    expect(await exchangeAppleCode(BUNDLE_ID, "one-shot-code")).toBe("rt-from-apple");

    expect(calls[0].url).toBe("https://appleid.apple.com/auth/token");
    expect(calls[0].body.get("grant_type")).toBe("authorization_code");
    expect(calls[0].body.get("code")).toBe("one-shot-code");
    expect(calls[0].body.get("client_id")).toBe(BUNDLE_ID);
    expect(calls[0].body.get("client_secret")).toBeTruthy();
    // A code minted on a device has no redirect to come back to, and sending
    // one anyway is rejected.
    expect(calls[0].body.has("redirect_uri")).toBe(false);
  });

  it("gives up quietly when Apple refuses the code", async () => {
    stubApple(new Response("invalid_grant", { status: 400 }));
    expect(await exchangeAppleCode(BUNDLE_ID, "already-spent")).toBeNull();
  });

  it("gives up quietly when Apple is unreachable", async () => {
    stubApple(new Error("network down"));
    expect(await exchangeAppleCode(BUNDLE_ID, "one-shot-code")).toBeNull();
  });

  it("gives up quietly when the answer carries no refresh token", async () => {
    stubApple(Response.json({ access_token: "at" }));
    expect(await exchangeAppleCode(BUNDLE_ID, "one-shot-code")).toBeNull();
  });
});
