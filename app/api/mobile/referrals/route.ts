import { authedRoute, body, OPTIONS } from "@/lib/mobile/api";
import {
  ensureReferralHandle,
  getReferralBoard,
  handleProblemMessage,
  referralCount,
  setReferralHandle,
} from "@/lib/referral";
import { updateReferralSchema } from "@/lib/validation";
import { GameError } from "@/lib/game/errors";
import { SITE_URL } from "@/lib/site";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { rateLimit } from "@/lib/rateLimit";

export { OPTIONS };

/** Your link and count, plus the leaderboard. */
export const GET = authedRoute(async (me) => {
  const [handle, count, board] = await Promise.all([
    ensureReferralHandle(me.id),
    referralCount(me.id),
    getReferralBoard(me.id),
  ]);
  return { handle, url: `${SITE_URL}/r/${handle}`, count, board };
});

/** Change your link, or opt in and out of the board. */
export const PATCH = authedRoute(async (me, request) => {
  if (!(await rateLimit(`referral:${me.id}`, 10, 60 * 60 * 1000))) {
    throw new GameError("Too many changes. Please try again later.", 429);
  }

  const parsed = updateReferralSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new GameError(parsed.error.issues[0]?.message ?? "Please check the form.", 400);
  }
  const { referralHandle, hideFromBoard } = parsed.data;

  if (referralHandle !== undefined) {
    const result = await setReferralHandle(me.id, referralHandle);
    if (result === "unknown-user") throw new GameError("Unknown account.", 404);
    if (result === "taken") throw new GameError("That link is already taken.", 409);
    if (result !== "ok") throw new GameError(handleProblemMessage(result), 400);
  }

  if (hideFromBoard !== undefined) {
    await connectDB();
    await User.updateOne({ _id: me.id }, { hideFromReferralBoard: hideFromBoard });
  }

  const handle = await ensureReferralHandle(me.id);
  return { handle, url: `${SITE_URL}/r/${handle}` };
});
