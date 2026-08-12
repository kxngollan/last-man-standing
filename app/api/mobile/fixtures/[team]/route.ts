import { publicRoute, OPTIONS } from "@/lib/mobile/api";
import { getFixturesForTeam } from "@/lib/game/browse";
import { GameError } from "@/lib/game/errors";

export { OPTIONS };

/** One club's season, split around its next game. Public. */
export const GET = publicRoute(async (_request, { params }) => {
  const { team } = await params;
  const data = await getFixturesForTeam(team);
  if (!data) throw new GameError("Unknown team.", 404);
  return data;
});
