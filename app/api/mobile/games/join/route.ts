import { authedRoute, OPTIONS } from "@/lib/mobile/api";
import { joinGame } from "@/lib/game/join";

export { OPTIONS };

/** Join the open game. Idempotent — joining twice is not an error. */
export const POST = authedRoute(async (me) => {
  await joinGame(me.id);
  return { ok: true };
});
