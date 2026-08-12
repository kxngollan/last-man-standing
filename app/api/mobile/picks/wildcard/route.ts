import { authedRoute, OPTIONS } from "@/lib/mobile/api";
import { playWildcard, undoWildcard } from "@/lib/game/pick";

export { OPTIONS };

/** Arm the wildcard on this week's pick. One per game. */
export const POST = authedRoute(async (me) => {
  await playWildcard(me.id);
  return { ok: true };
});

/** Take it back — allowed until the deadline. */
export const DELETE = authedRoute(async (me) => {
  await undoWildcard(me.id);
  return { ok: true };
});
