import { authedRoute, body, OPTIONS } from "@/lib/mobile/api";
import { deleteOwnAccount, renameUser } from "@/lib/account";
import { ensureReferralHandle, referralCount } from "@/lib/referral";
import { deleteAccountSchema, updateNameSchema } from "@/lib/validation";
import { nameParts } from "@/lib/displayName";
import { GameError } from "@/lib/game/errors";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { rateLimit } from "@/lib/rateLimit";

export { OPTIONS };

/**
 * The signed-in player. Doubles as the app's "is my token still good?" check —
 * a 401 here means sign in again.
 */
export const GET = authedRoute(async (me) => {
  await connectDB();
  const user = await User.findById(me.id)
    .select("name firstName lastName email dob createdAt hideFromReferralBoard")
    .lean();
  if (!user) throw new GameError("Unknown account.", 404);

  const { first, last } = nameParts(user);
  const [referralHandle, referrals] = await Promise.all([
    ensureReferralHandle(me.id),
    referralCount(me.id),
  ]);

  return {
    id: me.id,
    firstName: first,
    lastName: last,
    name: user.name,
    email: user.email,
    isAdmin: me.isAdmin,
    // Null between a Google/Apple sign-up and the web's /welcome step, which is
    // where a date of birth gets collected.
    dob: user.dob ? new Date(user.dob).toISOString() : null,
    memberSince: new Date(user.createdAt).toISOString(),
    referralHandle,
    referrals,
    hideFromReferralBoard: user.hideFromReferralBoard === true,
  };
});

/** Rename yourself. */
export const PATCH = authedRoute(async (me, request) => {
  if (!(await rateLimit(`rename:${me.id}`, 10, 60 * 60 * 1000))) {
    throw new GameError("Too many changes. Please try again later.", 429);
  }

  const parsed = updateNameSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new GameError(parsed.error.issues[0]?.message ?? "Please check the form.", 400);
  }

  const updated = await renameUser(me.id, parsed.data.firstName, parsed.data.lastName);
  if (!updated) throw new GameError("Unknown account.", 404);
  return updated;
});

/**
 * Delete your account and everything in it. Required to be here: Apple's
 * guideline 5.1.1(v) and Play's data deletion policy both want deletion
 * reachable from inside the app, not by emailing support.
 *
 * No token to revoke afterwards — userFromToken() looks the account up on every
 * request, so every bearer token for it starts failing the moment it's gone.
 */
export const DELETE = authedRoute(async (me, request) => {
  if (!(await rateLimit(`delete-account:${me.id}`, 5, 60 * 60 * 1000))) {
    throw new GameError("Too many attempts. Please try again later.", 429);
  }

  const parsed = deleteAccountSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new GameError(parsed.error.issues[0]?.message ?? "Type DELETE to confirm.", 400);
  }

  const result = await deleteOwnAccount(me.id);
  if (result === "unknown-user") throw new GameError("Unknown account.", 404);
  if (result === "is-admin") {
    throw new GameError(
      "Admin accounts can’t be deleted here. Get in touch and we’ll do it for you.",
      403
    );
  }
  return { ok: true as const };
});
