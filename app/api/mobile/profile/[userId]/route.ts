import { authedRoute, OPTIONS } from "@/lib/mobile/api";
import { getUserProfile } from "@/lib/game/profile";
import { GameError } from "@/lib/game/errors";

export { OPTIONS };

/**
 * A player's record. Pass "me" for your own — which is also what decides
 * whether picks for a week that hasn't started are visible.
 */
export const GET = authedRoute(async (me, _request, { params }) => {
  const { userId } = await params;
  const target = userId === "me" ? me.id : userId;
  const profile = await getUserProfile(target, me.id);
  if (!profile) throw new GameError("Unknown player.", 404);
  return profile;
});
