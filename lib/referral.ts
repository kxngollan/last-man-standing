import mongoose from "mongoose";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { UserReferralHandle } from "@/models/User/UserReferralHandle";
import { UserReferredBy } from "@/models/User/UserReferredBy";
import { publicName } from "@/lib/displayName";

/**
 * Referral links: www.footballlms.com/r/<handle>.
 *
 * Every player starts with their own id as their handle, so a link works from
 * the moment they sign up. Changing it rewrites the row, which means links
 * already shared stop resolving — deliberate, and the settings page says so.
 *
 * A freed handle is claimable by anyone, with one exception: an id-shaped
 * string can never be *chosen* (see validateHandle). Without that rule, setting
 * a custom handle would release your id for someone else to claim, and every
 * /r/<your id> link ever shared would land on them.
 */

export const MIN_HANDLE = 3;
export const MAX_HANDLE = 30;

/** Mongo ObjectId hex — the shape every default handle takes. */
const ID_SHAPED = /^[0-9a-f]{24}$/i;
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// Names that would let someone pass their link off as the game's own.
const RESERVED = new Set([
  "admin",
  "administrator",
  "api",
  "help",
  "lastmanstanding",
  "lms",
  "login",
  "moderator",
  "official",
  "root",
  "settings",
  "signup",
  "support",
  "system",
]);

export type HandleProblem = "ok" | "format" | "reserved" | "id-shaped";

/** Whether a player may claim this string. Pure — no database. */
export function validateHandle(raw: string): HandleProblem {
  const handle = raw.trim().toLowerCase();
  if (ID_SHAPED.test(handle)) return "id-shaped";
  if (handle.length < MIN_HANDLE || handle.length > MAX_HANDLE) return "format";
  if (!HANDLE_RE.test(handle)) return "format";
  if (handle.includes("--")) return "format";
  if (RESERVED.has(handle)) return "reserved";
  return "ok";
}

/** The message shown for each rejection. */
export function handleProblemMessage(problem: HandleProblem): string {
  switch (problem) {
    case "reserved":
      return "That one’s reserved. Try another.";
    case "id-shaped":
      return "That looks like an account id, which can’t be used as a link.";
    case "format":
      return `Use ${MIN_HANDLE}–${MAX_HANDLE} letters, numbers and hyphens, starting and ending with a letter or number.`;
    default:
      return "";
  }
}

/**
 * This player's handle, creating the default (their own id) the first time it's
 * asked for. Lazy rather than backfilled, so accounts predating the feature
 * pick one up on their next visit.
 */
export async function ensureReferralHandle(userId: string): Promise<string> {
  await connectDB();
  const existing = await UserReferralHandle.findOne({ userId }).lean();
  if (existing) return existing.referralHandle;

  const fallback = String(userId).toLowerCase();
  try {
    await UserReferralHandle.create({ userId, referralHandle: fallback });
    return fallback;
  } catch (err: unknown) {
    // Two requests raced to create it — whoever won, read theirs back.
    if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
      const row = await UserReferralHandle.findOne({ userId }).lean();
      if (row) return row.referralHandle;
    }
    throw err;
  }
}

/**
 * The player behind a shared link, or null if nothing holds that handle.
 *
 * The id-shaped fallback covers accounts that predate this feature and haven't
 * had a row created yet: their own id is their handle whether or not it's been
 * written down. It only applies while they hold no row at all, so once someone
 * picks a custom handle their id link goes dead exactly as intended.
 */
export async function resolveHandle(handle: string): Promise<string | null> {
  const key = handle.trim().toLowerCase();
  if (!key) return null;
  await connectDB();

  const row = await UserReferralHandle.findOne({ referralHandle: key }).lean();
  if (row) return String(row.userId);

  if (!ID_SHAPED.test(key)) return null;
  const claimed = await UserReferralHandle.findOne({ userId: key }).select("_id").lean();
  if (claimed) return null; // they've chosen a handle — this link is retired
  const user = await User.findById(key).select("_id").lean();
  return user ? String(user._id) : null;
}

export type SetHandleResult = HandleProblem | "taken" | "unknown-user";

/** Claim a new handle. The unique index decides who wins a race, not a check. */
export async function setReferralHandle(
  userId: string,
  raw: string
): Promise<SetHandleResult> {
  if (!mongoose.isValidObjectId(userId)) return "unknown-user";
  const problem = validateHandle(raw);
  if (problem !== "ok") return problem;

  await connectDB();
  const user = await User.findById(userId).select("_id").lean();
  if (!user) return "unknown-user";

  const handle = raw.trim().toLowerCase();
  try {
    await UserReferralHandle.findOneAndUpdate(
      { userId },
      { userId, referralHandle: handle },
      { upsert: true }
    );
    return "ok";
  } catch (err: unknown) {
    if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
      return "taken";
    }
    throw err;
  }
}

/** The cookie a shared link drops, read only by the signup route. */
export const REF_COOKIE = "lms_ref";
export const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * The link is resolved when it's *clicked*, and the referrer's id travels in
 * the cookie alongside the handle. Re-resolving at signup instead would mean a
 * handle freed and reclaimed between the click and the registration credits the
 * new owner. Ids are hex, so "." separates them unambiguously.
 */
export function encodeReferralCookie(referrerUserId: string, handle: string): string {
  return `${referrerUserId}.${handle.trim().toLowerCase()}`;
}

export function parseReferralCookie(
  value: string | undefined | null
): { referrerUserId: string; handle: string } | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const referrerUserId = value.slice(0, dot);
  const handle = value.slice(dot + 1);
  if (!mongoose.isValidObjectId(referrerUserId) || !handle) return null;
  return { referrerUserId, handle };
}

/**
 * Record who brought a new player in, at signup. Unconfirmed until they verify
 * their email. Silently does nothing when there's nobody to credit — a stale,
 * forged or self-referring cookie must never block a registration.
 */
export async function recordReferral(newUserId: string, cookieValue?: string | null): Promise<void> {
  const parsed = parseReferralCookie(cookieValue);
  if (!parsed) return;
  if (parsed.referrerUserId === String(newUserId)) return; // no crediting yourself

  await connectDB();
  // The cookie is client-held, so confirm the referrer is still a real account.
  const referrer = await User.findById(parsed.referrerUserId).select("_id").lean();
  if (!referrer) return;

  try {
    await UserReferredBy.create({
      userId: newUserId,
      referrerUserId: parsed.referrerUserId,
      handleUsed: parsed.handle,
      confirmed: false,
    });
  } catch (err: unknown) {
    // Already referred — a player is claimed once and it never changes.
    if (typeof err === "object" && err && (err as { code?: number }).code === 11000) return;
    throw err;
  }
}

/** Count the referral once the new player has proved their inbox. */
export async function confirmReferral(userId: string): Promise<void> {
  await connectDB();
  await UserReferredBy.updateOne({ userId }, { confirmed: true });
}

/** Remove a player's referral rows — used when signup rolls back. */
export async function clearReferralRecords(userId: string): Promise<void> {
  await connectDB();
  await Promise.all([
    UserReferralHandle.deleteOne({ userId }),
    UserReferredBy.deleteOne({ userId }),
  ]);
}

/** How many players this one has brought in and had confirmed. */
export async function referralCount(userId: string): Promise<number> {
  if (!mongoose.isValidObjectId(userId)) return 0;
  await connectDB();
  return UserReferredBy.countDocuments({ referrerUserId: userId, confirmed: true });
}

export interface ReferralBoardRow {
  rank: number;
  name: string;
  count: number;
  you: boolean;
}

/**
 * Who has brought in the most players. Opted-out players are dropped entirely
 * rather than anonymised — they asked to be off the board.
 */
export async function getReferralBoard(
  viewerId: string,
  limit = 25
): Promise<ReferralBoardRow[]> {
  await connectDB();

  const totals = await UserReferredBy.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
    { $match: { confirmed: true } },
    { $group: { _id: "$referrerUserId", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    // Room to drop the opted-out without leaving the board short.
    { $limit: limit * 4 },
  ]);
  if (totals.length === 0) return [];

  const users = await User.find({ _id: { $in: totals.map((t) => t._id) } })
    .select("name firstName lastName hideFromReferralBoard")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return totals
    .filter((t) => {
      const u = byId.get(String(t._id));
      return u && !u.hideFromReferralBoard;
    })
    .slice(0, limit)
    .map((t, i) => ({
      rank: i + 1,
      // Public board — "Sam K.", the same as the standings.
      name: publicName(byId.get(String(t._id))!),
      count: t.n,
      you: String(t._id) === String(viewerId),
    }));
}
