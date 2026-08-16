import { connectDB } from "@/database/connect";
import { User, type IOAuthAccount, type OAuthProvider } from "@/models/User/User";
import { isAdminEmail } from "@/lib/adminEmails";
import isEmail from "@/lib/isEmail";
import { isOldEnough, needsParentalConsent } from "@/lib/age";
import { confirmReferral, ensureReferralHandle, recordReferral } from "@/lib/referral";
import type { SocialConsent } from "@/lib/socialConsent";
import type { LoginUser } from "@/lib/login";

/**
 * Signing in with Google or Apple.
 *
 * There is no Auth.js database adapter here — sessions are JWTs — so the account
 * lookup, the linking and the first-time registration all happen in this one
 * place, called from the `signIn` callback in auth.ts. Keeping it out of the
 * callback is what makes it testable without a browser and a real provider.
 *
 * The rules, in short:
 *   1. A provider account we've seen before signs in as its owner.
 *   2. A verified address that matches an existing account links to it.
 *   3. An address we've never seen creates nothing. Clicking "Continue with
 *      Google" is not an instruction to register — the player is asked first
 *      (/signup/social) and comes back carrying a consent for this exact
 *      address, with the date of birth the age gate needs.
 */

export interface OAuthIdentity {
  provider: OAuthProvider;
  /** The provider's `sub`. Never the email. */
  providerAccountId: string;
  email?: string | null;
  /** Whether the *provider* says it has verified the address. */
  emailVerified: boolean;
  firstName?: string | null;
  lastName?: string | null;
  /** Whole name, when the provider doesn't split it. */
  name?: string | null;
  /**
   * Apple only, and kept so that deleting the account can revoke it — see
   * models/User/User.ts. Apple hands one over on every code exchange, so a
   * sign-in also refreshes what's stored and backfills accounts that predate
   * this being recorded.
   */
  refreshToken?: string | null;
  /** Which Apple client that refresh token belongs to. Useless without it. */
  clientId?: string | null;
}

export interface OAuthSignInOptions {
  /** The `lms_ref` cookie, so a referral survives a social sign-up. */
  referralCookie?: string | null;
  /**
   * Present only when the player has been through the confirmation screen and
   * said yes. Verified against the identity the provider just handed us.
   */
  consent?: SocialConsent | null;
}

export type OAuthLoginResult =
  | { ok: true; user: LoginUser; created: boolean }
  | {
      ok: false;
      reason:
        | "malformed"
        | "unverified-email"
        | "no-account"
        | "too-young"
        | "needs-parental-consent"
        | "error";
    };

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * A first and last name out of whatever the provider gave us.
 *
 * Apple only sends a name the very first time someone consents, and its
 * provider config falls back to the email address when it has none — so an
 * address here means "no name", not a name.
 */
function namesFrom(identity: OAuthIdentity, email: string): { first: string; last: string } {
  const first = (identity.firstName ?? "").trim();
  const last = (identity.lastName ?? "").trim();
  if (first) return { first, last };

  const whole = (identity.name ?? "").trim();
  const words = whole.includes("@") ? [] : whole.split(/\s+/).filter(Boolean);
  if (words.length > 1) return { first: words[0], last: words[words.length - 1] };
  if (words.length === 1) return { first: words[0], last: "" };

  // Last resort so the account has something to be called. They can rename
  // themselves in settings.
  return { first: email.split("@")[0].slice(0, 40), last: "" };
}

/**
 * What we keep so the account can be revoked at Apple when it's deleted.
 *
 * Empty for Google, and empty for an Apple sign-in that didn't come with a
 * token — the app's second call carries only an id token, and Apple issues a
 * refresh token once per consent. Spreading an empty object is what makes the
 * callers safe: a later sign-in with nothing to say must not blank out a
 * perfectly good token stored by an earlier one.
 */
function revocationCredentials(identity: OAuthIdentity): {
  refreshToken?: string;
  clientId?: string;
} {
  if (identity.provider !== "apple") return {};
  const refreshToken = (identity.refreshToken ?? "").trim();
  const clientId = (identity.clientId ?? "").trim();
  // Neither is any use on its own: revoking needs both.
  if (!refreshToken || !clientId) return {};
  return { refreshToken, clientId };
}

/** Store a fresh refresh token against an identity we already know. */
async function rememberCredentials(
  user: { oauthAccounts?: IOAuthAccount[]; save: () => Promise<unknown> },
  identity: OAuthIdentity
): Promise<void> {
  const credentials = revocationCredentials(identity);
  if (!credentials.refreshToken) return;

  const account = (user.oauthAccounts ?? []).find(
    (a) => a.provider === identity.provider && a.providerAccountId === identity.providerAccountId
  );
  if (!account || account.refreshToken === credentials.refreshToken) return;

  Object.assign(account, credentials);
  try {
    await user.save();
  } catch (err) {
    // Losing this costs a revocation at deletion time, not a sign-in. Whoever
    // is at the door gets in either way.
    console.error("[auth] storing apple refresh token failed:", (err as Error).message);
  }
}

/**
 * Store an Apple refresh token against an account that has just signed in.
 *
 * For the app only. A phone hands over an authorization code rather than a
 * token, and the code can only be spent once — so unlike the website, which has
 * its token in hand before signInWithOAuth() runs, the app's is obtained
 * afterwards and attached here. See lib/apple/exchangeCode.ts.
 */
export async function rememberAppleRefreshToken(
  userId: string,
  identity: OAuthIdentity
): Promise<void> {
  if (!revocationCredentials(identity).refreshToken) return;
  const user = await User.findById(userId);
  if (user) await rememberCredentials(user, identity);
}

export async function signInWithOAuth(
  identity: OAuthIdentity,
  options: OAuthSignInOptions = {}
): Promise<OAuthLoginResult> {
  const { referralCookie, consent } = options;
  const provider = identity.provider;
  const providerAccountId =
    typeof identity.providerAccountId === "string" ? identity.providerAccountId.trim() : "";
  const email = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";

  if (!providerAccountId || !isEmail(email)) return { ok: false, reason: "malformed" };

  // Everything below rests on the provider having proved the address: linking
  // to an existing account, marking it verified, granting admin from the
  // allowlist. Google will report `email_verified: false` for some addresses,
  // and taking one at face value would hand whoever holds that Google account
  // the matching password account here.
  if (!identity.emailVerified) return { ok: false, reason: "unverified-email" };

  try {
    await connectDB();

    // Seen this identity before? The subject id is the real identity — it
    // survives the user changing their email at the provider.
    let user = await User.findOne({
      oauthAccounts: { $elemMatch: { provider, providerAccountId } },
    });
    let created = false;

    if (user) {
      // A returning Apple sign-in arrives with a fresh refresh token. Storing
      // it each time keeps deletion able to revoke, and backfills the accounts
      // that linked before any of this was kept.
      await rememberCredentials(user, identity);
    } else {
      user = await linkToExistingAccount(email, provider, providerAccountId, identity);
    }

    if (!user) {
      // Nobody by this identity and nobody by this address. Registering is a
      // decision the player makes on the confirmation screen, not a side effect
      // of clicking a provider button — so without a consent for this exact
      // address, we create nothing and send them there.
      if (!consent || consent.provider !== provider || consent.email !== email) {
        return { ok: false, reason: "no-account" };
      }

      // The consent carries the one thing no provider gives us. It's checked
      // here as well as at the screen that collected it, because this is the
      // only place an account can actually come into existence.
      const dob = new Date(consent.dob);
      if (Number.isNaN(dob.getTime())) return { ok: false, reason: "malformed" };
      if (!isOldEnough(dob)) return { ok: false, reason: "too-young" };
      const minorConsent = needsParentalConsent(dob);
      if (minorConsent && consent.parentalConsent !== true) {
        return { ok: false, reason: "needs-parental-consent" };
      }

      const { first, last } = namesFrom(identity, email);
      try {
        user = await User.create({
          firstName: first,
          lastName: last,
          // `name` mirrors the split fields, same as the sign-up route.
          name: [first, last].filter(Boolean).join(" "),
          email,
          dob,
          parentalConsent: minorConsent,
          // The provider has proved the inbox, which is exactly what the
          // confirmation email proves — so this account is verified from the
          // start, and the admin allowlist applies on the same footing it does
          // at email verification (lib/verification.ts). Nobody can squat an
          // admin address they don't control.
          emailVerified: true,
          isAdmin: isAdminEmail(email),
          oauthAccounts: [{ provider, providerAccountId, ...revocationCredentials(identity) }],
        });
        created = true;
      } catch (err) {
        // Two tabs, one new player: the unique email index picks a winner and
        // the loser links to the account that won.
        if (!isDuplicateKey(err)) throw err;
        user = await linkToExistingAccount(email, provider, providerAccountId, identity);
        if (!user) return { ok: false, reason: "error" };
      }

      if (created) {
        // Their own referral link, and credit to whoever sent them. Confirmed
        // immediately: the inbox is already proven, which is the bar the email
        // flow sets. None of it may fail a registration that has succeeded.
        try {
          await ensureReferralHandle(String(user._id));
          await recordReferral(String(user._id), referralCookie);
          await confirmReferral(String(user._id));
        } catch (err) {
          console.error("[auth] oauth referral bookkeeping failed:", (err as Error).message);
        }
      }
    }

    return {
      ok: true,
      created,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        // No date of birth means the age gate has never been applied to this
        // account. proxy.ts holds it at /welcome until it has been.
        needsOnboarding: !user.dob,
      },
    };
  } catch (err) {
    console.error("[auth] oauth sign-in failed:", (err as Error).message);
    return { ok: false, reason: "error" };
  }
}

/**
 * Attach this provider account to the existing account with the same address,
 * if there is one. Returns null when there's nobody to link to.
 *
 * The address has already been verified by the provider at this point, so an
 * account that never confirmed its own sign-up email is settled here — the same
 * proof, arriving by a different door.
 */
async function linkToExistingAccount(
  email: string,
  provider: OAuthProvider,
  providerAccountId: string,
  identity: OAuthIdentity
) {
  const user = await User.findOne({ email });
  if (!user) return null;

  const alreadyLinked = (user.oauthAccounts ?? []).some(
    (a) => a.provider === provider && a.providerAccountId === providerAccountId
  );
  if (alreadyLinked) {
    await rememberCredentials(user, identity);
  } else {
    user.oauthAccounts = [
      ...(user.oauthAccounts ?? []),
      { provider, providerAccountId, ...revocationCredentials(identity) },
    ];
  }

  const wasUnverified = !user.emailVerified;
  if (wasUnverified) {
    user.emailVerified = true;
    if (isAdminEmail(user.email)) user.isAdmin = true;
  }
  await user.save();

  if (wasUnverified) {
    try {
      await confirmReferral(String(user._id));
    } catch (err) {
      console.error("[auth] oauth referral confirm failed:", (err as Error).message);
    }
  }
  return user;
}
