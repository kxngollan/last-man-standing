import { connectDB } from "@/database/connect";
import { User, type OAuthProvider } from "@/models/User/User";
import { isAdminEmail } from "@/lib/adminEmails";
import isEmail from "@/lib/isEmail";
import { confirmReferral, ensureReferralHandle, recordReferral } from "@/lib/referral";
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
 *   3. Anything else is a new account — with no password and no date of birth,
 *      which is what sends it to /welcome before it can play.
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
}

export type OAuthLoginResult =
  | { ok: true; user: LoginUser; created: boolean }
  | { ok: false; reason: "malformed" | "unverified-email" | "error" };

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
  // themselves in settings, and /welcome asks them to.
  return { first: email.split("@")[0].slice(0, 40), last: "" };
}

export async function signInWithOAuth(
  identity: OAuthIdentity,
  referralCookie?: string | null
): Promise<OAuthLoginResult> {
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

    if (!user) user = await linkToExistingAccount(email, provider, providerAccountId);

    if (!user) {
      const { first, last } = namesFrom(identity, email);
      try {
        user = await User.create({
          firstName: first,
          lastName: last,
          // `name` mirrors the split fields, same as the sign-up route.
          name: [first, last].filter(Boolean).join(" "),
          email,
          // The provider has proved the inbox, which is exactly what the
          // confirmation email proves — so this account is verified from the
          // start, and the admin allowlist applies on the same footing it does
          // at email verification (lib/verification.ts). Nobody can squat an
          // admin address they don't control.
          emailVerified: true,
          isAdmin: isAdminEmail(email),
          oauthAccounts: [{ provider, providerAccountId }],
        });
        created = true;
      } catch (err) {
        // Two tabs, one new player: the unique email index picks a winner and
        // the loser links to the account that won.
        if (!isDuplicateKey(err)) throw err;
        user = await linkToExistingAccount(email, provider, providerAccountId);
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
        // No date of birth means the 16+ gate has never been applied to this
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
  providerAccountId: string
) {
  const user = await User.findOne({ email });
  if (!user) return null;

  const alreadyLinked = (user.oauthAccounts ?? []).some(
    (a) => a.provider === provider && a.providerAccountId === providerAccountId
  );
  if (!alreadyLinked) {
    user.oauthAccounts = [...(user.oauthAccounts ?? []), { provider, providerAccountId }];
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
