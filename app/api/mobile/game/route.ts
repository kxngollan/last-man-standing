import { authedRoute, OPTIONS } from "@/lib/mobile/api";
import { getGameStateForUser, getPickSummary } from "@/lib/game/queries";

export { OPTIONS };

/**
 * Everything the app's main screen needs, in one call: the game, your entry,
 * the deadline, the pickable teams, your pick, the first page of standings and
 * your own pick history. Same PortalState the web portal renders from.
 *
 * The pick summary rides along because every screen that shows the board wants
 * it; a second round trip from a phone on mobile data is worth avoiding.
 */
export const GET = authedRoute(async (me) => {
  const [state, summary] = await Promise.all([
    getGameStateForUser(me.id),
    getPickSummary({ playersPerTeam: 3 }).catch(() => null),
  ]);
  return { ...state, summary };
});
