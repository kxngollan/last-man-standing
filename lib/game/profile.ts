import mongoose from "mongoose";
import { connectDB } from "@/database/connect";
import { Game, type IGame } from "@/models/Game/Game";
import { Entry, type IEntry } from "@/models/Game/Entry";
import { Pick, type IPick } from "@/models/Game/Pick";
import { Team } from "@/models/Teams/Team";
import { User } from "@/models/User/User";
import { publicName, fullName, initialsOf } from "@/lib/displayName";
import { survived, rankOfEntry } from "./queries";
import type {
  HeadToHead,
  ProfileGame,
  ProfilePick,
  ProfileStats,
  ProfileTeamTally,
  UserProfile,
} from "./portalTypes";

/**
 * A player's record: every game they've entered, the picks behind it and the
 * career totals.
 *
 * Unlike the standings and the /picks board — which publish the open week's
 * picks on purpose so everyone decides off the same information — a profile
 * only goes as far as the week in play. A pick for a game week that hasn't
 * started is left out entirely, and shown to nobody but its owner, flagged so
 * the UI can say as much. Career totals are counted from the visible picks
 * alone, so a counter can never give away the pick it excludes.
 *
 * Players can only ever pick one week ahead (see getPickWindow), and resolve
 * deletes an eliminated player's picks beyond their exit, so this hides at
 * most one row, belonging to a player still in the game.
 */
export async function getUserProfile(
  userId: string,
  viewerId: string
): Promise<UserProfile | null> {
  if (!mongoose.isValidObjectId(userId)) return null;
  await connectDB();

  const user = await User.findById(userId).select("name firstName lastName createdAt").lean();
  if (!user) return null;

  const isSelf = String(user._id) === String(viewerId);
  const base = {
    id: String(user._id),
    name: isSelf ? fullName(user) || publicName(user) : publicName(user),
    initials: initialsOf(user.name),
    memberSince: user.createdAt.toISOString(),
    isSelf,
  };

  const entries = await Entry.find({ userId: user._id }).lean();
  if (entries.length === 0) {
    return { ...base, current: null, past: [], stats: emptyStats(), headToHead: null };
  }

  const gameIds = entries.map((e) => e.gameId);
  const entryIds = entries.map((e) => e._id);

  const [games, picks, teams, ordinals, playerTotals] = await Promise.all([
    Game.find({ _id: { $in: gameIds } }).lean(),
    // By entryId, not userId: this rides the {entryId, matchday} index.
    Pick.find({ entryId: { $in: entryIds } })
      .sort({ matchday: 1 })
      .lean(),
    Team.find({}).lean(),
    gameOrdinals(),
    Entry.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { gameId: { $in: gameIds } } },
      { $group: { _id: "$gameId", n: { $sum: 1 } } },
    ]),
  ]);

  const teamById = new Map(teams.map((t) => [t.apiId, t]));
  const gameById = new Map(games.map((g) => [String(g._id), g]));
  const totalById = new Map(playerTotals.map((t) => [String(t._id), t.n]));

  const picksByEntry = new Map<string, IPick[]>();
  for (const p of picks) {
    const key = String(p.entryId);
    const list = picksByEntry.get(key);
    if (list) list.push(p);
    else picksByEntry.set(key, [p]);
  }

  // Newest game first — the open one, when there is one, leads.
  const ordered = entries
    .filter((e) => gameById.has(String(e.gameId)))
    .sort(
      (a, b) =>
        gameById.get(String(b.gameId))!.createdAt.getTime() -
        gameById.get(String(a.gameId))!.createdAt.getTime()
    );

  /** Every pick counted towards career totals, with the game it belongs to. */
  const counted: Array<{ pick: IPick; game: IGame }> = [];
  const profileGames: ProfileGame[] = [];

  for (const entry of ordered) {
    const game = gameById.get(String(entry.gameId))!;
    const all = picksByEntry.get(String(entry._id)) ?? [];

    const rows: ProfilePick[] = [];
    for (const p of all) {
      // The rule: nothing beyond the week being played, except your own.
      const hiddenFromOthers = p.matchday > game.currentMatchday;
      if (hiddenFromOthers && !isSelf) continue;
      if (!hiddenFromOthers) counted.push({ pick: p, game });

      const team = p.teamApiId != null ? teamById.get(p.teamApiId) : null;
      rows.push({
        matchday: p.matchday,
        gameWeek: p.matchday - game.startMatchday + 1,
        teamName: team?.name ?? null,
        tla: team?.tla ?? null,
        crest: team?.crest ?? null,
        result: p.result,
        isWildcard: p.isWildcard,
        autoPicked: p.autoPicked,
        hiddenFromOthers,
      });
    }

    profileGames.push({
      no: ordinals.get(String(game._id)) ?? 0,
      season: game.season,
      status: game.status,
      isCurrent: game.status !== "finished",
      entryStatus: entry.status,
      survivedWeeks: survived(game.startMatchday, entry.eliminatedAtMatchday ?? game.currentMatchday),
      eliminatedGameWeek:
        entry.eliminatedAtMatchday != null
          ? entry.eliminatedAtMatchday - game.startMatchday + 1
          : null,
      rank: await rankOfEntry(game._id, entry),
      playersTotal: totalById.get(String(game._id)) ?? 0,
      // Legacy teamless wildcard rows don't consume a team.
      teamsUsed: rows.filter((r) => !r.hiddenFromOthers && r.tla).length,
      picks: rows,
    });
  }

  const current = profileGames.find((g) => g.isCurrent) ?? null;
  const past = profileGames.filter((g) => !g.isCurrent);

  return {
    ...base,
    current,
    past,
    stats: buildStats(profileGames, counted, teamById, ordered),
    headToHead: isSelf ? null : await headToHead(viewerId, ordered),
  };
}

/** Just the display name — page metadata doesn't need the career queries. */
export async function getProfileName(userId: string, viewerId: string): Promise<string | null> {
  if (!mongoose.isValidObjectId(userId)) return null;
  await connectDB();
  const user = await User.findById(userId).select("name firstName lastName").lean();
  if (!user) return null;
  return String(user._id) === String(viewerId)
    ? fullName(user) || publicName(user)
    : publicName(user);
}

/**
 * Game number by id. Games run one after another, so a game's ordinal is its
 * position in creation order — the same number countDocuments({createdAt:
 * {$lte}}) gives elsewhere, in one query instead of one per game.
 */
async function gameOrdinals(): Promise<Map<string, number>> {
  const all = await Game.find({}).select("createdAt").sort({ createdAt: 1 }).lean();
  return new Map(all.map((g, i) => [String(g._id), i + 1]));
}

function emptyStats(): ProfileStats {
  return {
    gamesPlayed: 0,
    wins: 0,
    bestRun: 0,
    totalWeeksSurvived: 0,
    averageWeeks: 0,
    picksMade: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    winRate: null,
    wildcardsPlayed: 0,
    autoPicks: 0,
    favouriteTeam: null,
    nemesisTeam: null,
  };
}

function buildStats(
  games: ProfileGame[],
  counted: Array<{ pick: IPick; game: IGame }>,
  teamById: Map<number, { name: string; tla: string; crest?: string }>,
  entries: IEntry[]
): ProfileStats {
  const totalWeeks = games.reduce((sum, g) => sum + g.survivedWeeks, 0);
  const won = counted.filter((c) => c.pick.result === "win").length;
  const drawn = counted.filter((c) => c.pick.result === "draw").length;
  const lost = counted.filter((c) => c.pick.result === "loss").length;
  const decided = won + drawn + lost;

  // The team they were on when they went out — only for exits we can show.
  const exits = new Set(
    entries
      .filter((e) => e.eliminatedAtMatchday != null)
      .map((e) => `${String(e._id)}:${e.eliminatedAtMatchday}`)
  );

  return {
    gamesPlayed: games.length,
    wins: games.filter((g) => g.entryStatus === "winner").length,
    bestRun: games.reduce((best, g) => Math.max(best, g.survivedWeeks), 0),
    totalWeeksSurvived: totalWeeks,
    averageWeeks: games.length ? Math.round((totalWeeks / games.length) * 10) / 10 : 0,
    picksMade: counted.length,
    won,
    drawn,
    lost,
    winRate: decided ? Math.round((won / decided) * 100) : null,
    wildcardsPlayed: counted.filter((c) => c.pick.isWildcard).length,
    autoPicks: counted.filter((c) => c.pick.autoPicked).length,
    favouriteTeam: topTeam(
      counted.map((c) => c.pick),
      teamById
    ),
    nemesisTeam: topTeam(
      counted
        .map((c) => c.pick)
        .filter((p) => exits.has(`${String(p.entryId)}:${p.matchday}`)),
      teamById
    ),
  };
}

/** The most-picked team in a set of picks; ties break alphabetically. */
function topTeam(
  picks: IPick[],
  teamById: Map<number, { name: string; tla: string; crest?: string }>
): ProfileTeamTally | null {
  const counts = new Map<number, number>();
  for (const p of picks) {
    if (p.teamApiId == null || !teamById.has(p.teamApiId)) continue;
    counts.set(p.teamApiId, (counts.get(p.teamApiId) ?? 0) + 1);
  }
  const tallies = [...counts.entries()]
    .map(([apiId, count]) => {
      const t = teamById.get(apiId)!;
      return { name: t.name, tla: t.tla, crest: t.crest ?? null, count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return tallies[0] ?? null;
}

/**
 * The viewer's record against this player in the games they've both entered.
 * Ordered the way the standings are: still in beats out, then whoever lasted
 * longer.
 */
async function headToHead(viewerId: string, entries: IEntry[]): Promise<HeadToHead | null> {
  if (!mongoose.isValidObjectId(viewerId)) return null;
  const mine = await Entry.find({
    userId: viewerId,
    gameId: { $in: entries.map((e) => e.gameId) },
  }).lean();
  if (mine.length === 0) return null;

  const theirs = new Map(entries.map((e) => [String(e.gameId), e]));
  let viewerAhead = 0;
  let profileAhead = 0;
  let level = 0;

  for (const m of mine) {
    const t = theirs.get(String(m.gameId));
    if (!t) continue;
    const cmp = compareEntries(m, t);
    if (cmp < 0) viewerAhead++;
    else if (cmp > 0) profileAhead++;
    else level++;
  }

  const gamesShared = viewerAhead + profileAhead + level;
  return gamesShared ? { gamesShared, viewerAhead, profileAhead, level } : null;
}

/** Negative when `a` finished ahead of `b`, positive when behind, 0 when level. */
function compareEntries(a: IEntry, b: IEntry): number {
  const aOut = a.status === "alive" ? 0 : 1;
  const bOut = b.status === "alive" ? 0 : 1;
  if (aOut !== bOut) return aOut - bOut;
  const aElim = a.eliminatedAtMatchday ?? 9999;
  const bElim = b.eliminatedAtMatchday ?? 9999;
  return bElim - aElim;
}
