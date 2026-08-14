import { PIXELATED_CRESTS } from "./crests.generated";

/**
 * Which badge, if any, a team row shows.
 *
 * Club crests are registered trade marks, and pulling them from an API is not a
 * licence to publish them. Apple guideline 5.2.1 and Play's IP policy both act
 * on a rights holder's complaint rather than adjudicating the merits, so this is
 * a dial rather than a setting — move it without touching a component:
 *
 *   CREST_STYLE=pixel     (default) our own pixelated copies, from public/crests
 *   CREST_STYLE=official  the club's actual badge, hotlinked from football-data
 *   CREST_STYLE=none      no badge at all; both clients draw the lettered disc
 *
 * "pixel" reduces the exposure. It does not remove it — a badge has to stay
 * recognisable to be worth showing, and recognisable is what a trade mark
 * protects. "none" is the only setting with nothing to argue about, and it costs
 * nothing visually: the disc with the three-letter code is already what both
 * clients draw whenever a crest is missing, so the layout is unchanged.
 *
 * A Team carries both badges — `crest` is the club's own, as the API gave it to
 * us, and `pCrest` is the path to our pixelated copy — so this is decided when a
 * team is read, not when it is synced. Changing CREST_STYLE takes effect on the
 * next request; no re-sync, no migration, and nothing to undo if you change your
 * mind mid-review.
 */
export type CrestStyle = "pixel" | "official" | "none";

export const CREST_STYLE: CrestStyle = (() => {
  const raw = process.env.CREST_STYLE;
  return raw === "official" || raw === "none" ? raw : "pixel";
})();

/** The two badges a Team carries. */
export interface TeamCrests {
  /** The club's own badge on football-data.org's CDN. */
  crest?: string | null;
  /** Our pixelated copy, as a path on our own domain. */
  pCrest?: string | null;
}

/**
 * Where a pixelated badge lives, or null if we never made one for this club.
 *
 * Relative on purpose. The website renders it straight into `src`, and the app's
 * Crest component resolves a leading slash against its API host, so one stored
 * value serves both and neither breaks if the domain changes.
 *
 * Used at sync time to fill `pCrest`; `scripts/pixelate-crests.py` writes the
 * files and the manifest this reads.
 */
export function pixelCrestPath(tla: string): string | null {
  return PIXELATED_CRESTS.has(tla) ? `/crests/${tla}.png` : null;
}

/** The badge URL to render for a team under the current CREST_STYLE. */
export function crestFor(team: TeamCrests): string | null {
  if (CREST_STYLE === "none") return null;
  if (CREST_STYLE === "official") return team.crest ?? null;
  // A club we never managed to pixelate (an SVG source, usually) falls through
  // to the lettered disc rather than quietly showing the badge we meant to stop
  // using. Failing closed is the point.
  return team.pCrest ?? null;
}

/**
 * A team with `crest` already resolved to whatever CREST_STYLE allows.
 *
 * Applied once where teams are loaded (lib/game/teams.ts) so that every reader
 * downstream can go on treating `crest` as "the badge to show" and none of them
 * has to know this policy exists.
 */
export function resolveCrest<T extends TeamCrests>(team: T): T {
  return { ...team, crest: crestFor(team) };
}
