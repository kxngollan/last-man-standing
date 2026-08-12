import { authedRoute, OPTIONS } from "@/lib/mobile/api";
import { getStandingsPage, STANDINGS_PAGE_SIZE } from "@/lib/game/queries";

export { OPTIONS };

/** One page of the standings board — the app pages through as it scrolls. */
export const GET = authedRoute(async (me, request) => {
  const raw = Number(new URL(request.url).searchParams.get("offset") ?? 0);
  const offset = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  return getStandingsPage(me.id, offset, STANDINGS_PAGE_SIZE);
});
