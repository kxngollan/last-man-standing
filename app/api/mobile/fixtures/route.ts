import { publicRoute, OPTIONS } from "@/lib/mobile/api";
import { getFixturesForMatchday } from "@/lib/game/browse";

export { OPTIONS };

/** Fixtures for a game week — defaults to the current one. Public. */
export const GET = publicRoute(async (request) => {
  const raw = new URL(request.url).searchParams.get("matchday");
  const matchday = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  return getFixturesForMatchday(matchday);
});
