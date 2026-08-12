import { publicRoute, OPTIONS } from "@/lib/mobile/api";
import { getLeagueTable } from "@/lib/game/browse";

export { OPTIONS };

/** The Premier League table. Public — no token needed. */
export const GET = publicRoute(async () => getLeagueTable());
