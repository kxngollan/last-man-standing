import { authedRoute, body, OPTIONS } from "@/lib/mobile/api";
import { changeOwnPassword } from "@/lib/account";
import { changePasswordSchema } from "@/lib/validation";
import { sendPasswordChangedEmail } from "@/lib/email";
import { issueMobileToken } from "@/lib/mobile/auth";
import { GameError } from "@/lib/game/errors";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";

export { OPTIONS };

/**
 * Change your password from the app.
 *
 * Stamping passwordChangedAt kills every token issued before now — including
 * the one that made this call — so a fresh token comes back in the response.
 * The app should swap it into secure storage straight away, or the very next
 * request 401s. Every *other* device stays signed out, which is the point.
 */
export const POST = authedRoute(async (me, request) => {
  const userOk = await rateLimit(`pwchange:user:${me.id}`, 5, 15 * 60 * 1000);
  const ipOk = await rateLimit(`pwchange:ip:${clientIp(request)}`, 20, 15 * 60 * 1000);
  if (!userOk || !ipOk) {
    throw new GameError("Too many attempts. Please try again in a few minutes.", 429);
  }

  const parsed = changePasswordSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new GameError(parsed.error.issues[0]?.message ?? "Please check the form.", 400);
  }

  const result = await changeOwnPassword(
    me.id,
    parsed.data.currentPassword,
    parsed.data.newPassword
  );
  if (result === "unknown-user") throw new GameError("Unknown account.", 404);
  if (result === "wrong-password") throw new GameError("That isn’t your current password.", 400);

  // Already changed — a mail outage must not undo it or report failure.
  if (me.email) {
    try {
      await sendPasswordChangedEmail(me.email, `${SITE_URL}/forgot`);
    } catch (err) {
      console.error("[mobile] password-changed email failed:", (err as Error).message);
    }
  }

  const { token, expiresAt } = await issueMobileToken({
    id: me.id,
    name: me.name,
    email: me.email,
    isAdmin: me.isAdmin,
  });
  return { ok: true, token, expiresAt };
});
