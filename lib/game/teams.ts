import { Team, type ITeam } from "@/models/Teams/Team";
import { resolveCrest } from "@/lib/crests";

type LeanTeam = ITeam & { _id: unknown };

/**
 * Every team, with `crest` already resolved to the badge we are allowed to show.
 *
 * The one door onto the Team collection for anything that renders. A Team holds
 * both badges — the club's own and our pixelated copy — and picking between them
 * is a legal question, not a display one (lib/crests.ts). Doing it here means
 * that question is answered once, rather than at each of the dozen places that
 * put a crest on a row and would each have to remember.
 *
 * Read `Team` directly only where the badge is irrelevant — the resolver in
 * lib/game/resolve.ts wants names and ids, not artwork.
 */
export async function loadTeams(): Promise<LeanTeam[]> {
  const teams = await Team.find({}).lean();
  return teams.map(resolveCrest);
}

/** One team by three-letter code, resolved the same way. */
export async function loadTeamByTla(tla: string): Promise<LeanTeam | null> {
  const team = await Team.findOne({ tla: tla.toUpperCase() }).lean();
  return team ? resolveCrest(team) : null;
}
