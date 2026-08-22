import { authedRoute, body, OPTIONS } from "@/lib/mobile/api";
import { getPickSummary } from "@/lib/game/queries";
import { makePick } from "@/lib/game/pick";
import { pickSchema } from "@/lib/validation";
import { GameError } from "@/lib/game/errors";

export { OPTIONS };

/** Who's on which team this week. Public by design, like the web board. */
export const GET = authedRoute(async () => {
  return (
    (await getPickSummary()) ?? {
      gameWeek: 0,
      matchday: 0,
      totalPicks: 0,
      state: "open" as const,
      locked: false,
      counts: { safe: 0, pending: 0, out: 0 },
      excluded: 0,
      teams: [],
    }
  );
});

/** Make (or change) this week's pick. */
export const POST = authedRoute(async (me, request) => {
  const parsed = pickSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new GameError(parsed.error.issues[0]?.message ?? "Pick a team.", 400);
  }
  await makePick(me.id, parsed.data.teamApiId);
  return { ok: true };
});
