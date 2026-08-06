import { type Types, type HydratedDocument } from "mongoose";
import { connectDB } from "@/database/connect";
import { Game, type IGame } from "@/models/Game";
import { Entry, type IEntry } from "@/models/Entry";
import { Pick } from "@/models/Pick";
import { Team } from "@/models/Team";
import { Fixture } from "@/models/Fixture";
import { User } from "@/models/User";
import { publicName } from "@/lib/displayName";
import { getMatchdayDeadline, isLocked } from "./deadline";
import { getPickWindow } from "./pickWindow";
import { GameError } from "./errors";
import type {
  TeamOption,
  PortalState,
  AdminOverview,
  StandingRow,
  StandingsPage,
  PickSummary,
} from "./portalTypes";

export type { TeamOption, PortalState, AdminOverview } from "./portalTypes";

/** Standings rows per request — the board fetches further pages lazily. */
export const STANDINGS_PAGE_SIZE = 25;

/** The single global game currently open (registration or active), if any. */
export async function getCurrentGame(): Promise<HydratedDocument<IGame> | null> {
  await connectDB();
  return Game.findOne({ status: { $in: ["registration", "active"] } }).sort({ createdAt: -1 });
}

export async function getActiveGame(): Promise<HydratedDocument<IGame>> {
  await connectDB();
  const game = await Game.findOne({ status: "active" }).sort({ createdAt: -1 });
  if (!game) throw new GameError("There isn’t an active game right now.", 409);
  return game;
}

/**
 * The game open for picks — registration or active (anything but finished).
 * Players can lock in their pick during registration, before kickoff.
 */
export async function getPlayableGame(): Promise<HydratedDocument<IGame>> {
  await connectDB();
  const game = await Game.findOne({ status: { $in: ["registration", "active"] } }).sort({
    createdAt: -1,
  });
  if (!game) throw new GameError("There isn’t a game open right now.", 409);
  return game;
}

export async function requireAliveEntry(
  gameId: Types.ObjectId,
  userId: string | Types.ObjectId
): Promise<HydratedDocument<IEntry>> {
  const entry = await Entry.findOne({ gameId, userId });
  if (!entry) throw new GameError("You haven’t joined this game.", 409);
  if (entry.status !== "alive") throw new GameError("You’re out of this game.", 409);
  return entry;
}

const survived = (startMatchday: number, upto: number) => Math.max(0, upto - startMatchday);

/** Dynamic data for the admin control panel. */
export async function getAdminOverview(): Promise<AdminOverview> {
  await connectDB();
  const game = await getCurrentGame();
  const teamsSeeded = await Team.countDocuments({});

  const finished = await Game.find({ status: "finished" }).sort({ createdAt: -1 }).limit(10).lean();
  const winnerIds = finished.map((g) => g.winnerUserId).filter(Boolean);
  const winners = await User.find({ _id: { $in: winnerIds } })
    .select("name firstName lastName")
    .lean();
  const winnerName = new Map(winners.map((w) => [String(w._id), publicName(w)]));

  const pastGames = await Promise.all(
    finished.map(async (g) => {
      const no = await Game.countDocuments({ createdAt: { $lte: g.createdAt } });
      const weeks = g.currentMatchday - g.startMatchday + 1;
      if (g.noWinner) {
        return {
          no,
          outcome: `No winner. All out Week ${weeks}, restarted`,
          tone: "out" as const,
          weeks,
        };
      }
      const name = g.winnerUserId ? winnerName.get(String(g.winnerUserId)) ?? "a player" : "a player";
      return { no, outcome: `Won by ${name}`, tone: "safe" as const, weeks };
    })
  );

  let current: AdminOverview["current"] = null;
  if (game) {
    const [no, playersTotal, playersAlive, deadline] = await Promise.all([
      Game.countDocuments({ createdAt: { $lte: game.createdAt } }),
      Entry.countDocuments({ gameId: game._id }),
      Entry.countDocuments({ gameId: game._id, status: "alive" }),
      getMatchdayDeadline(game.season, game.currentMatchday),
    ]);
    current = {
      id: String(game._id),
      no,
      status: game.status,
      season: game.season,
      matchday: game.currentMatchday,
      gameWeek: game.currentMatchday - game.startMatchday + 1,
      playersTotal,
      playersAlive,
      deadline: deadline ? deadline.toISOString() : null,
      locked: isLocked(deadline),
    };
  }

  return { current, pastGames, teamsSeeded };
}

/* ---- Standings (paginated) ----------------------------------------------
 * Ordering (matches the old in-memory sort, plus a stable tie-break):
 *   1. alive entries first (winners have no alive rivals, so they top a
 *      finished game naturally),
 *   2. then by weeks survived, descending — encoded as eliminatedAtMatchday
 *      descending with null (never eliminated) treated as +inf,
 *   3. then by join time, so pagination never shuffles equal rows.
 */
const STANDINGS_SORT_FIELDS = {
  outRank: { $cond: [{ $eq: ["$status", "alive"] }, 0, 1] },
  elimSort: { $ifNull: ["$eliminatedAtMatchday", 9999] },
} as const;

/** Build display rows for a slice of entries (already in rank order). */
async function buildStandingRows(
  game: HydratedDocument<IGame>,
  entriesSlice: IEntry[],
  userId: string,
  firstRank: number
): Promise<StandingRow[]> {
  const md = game.currentMatchday;
  const entryIds = entriesSlice.map((e) => e._id);
  const userIds = entriesSlice.map((e) => e.userId);

  // Picks are fully public by design — including the open week's — so every
  // player sees the same board and nobody wonders where a result came from.
  const [users, teams, picks] = await Promise.all([
    User.find({ _id: { $in: userIds } })
      .select("name firstName lastName")
      .lean(),
    Team.find({}).lean(),
    Pick.find({ entryId: { $in: entryIds } })
      .sort({ matchday: -1 })
      .lean(),
  ]);
  // Standings are public — show "First L.", never the full surname.
  const nameById = new Map(users.map((u) => [String(u._id), publicName(u)]));
  const teamById = new Map(teams.map((t) => [t.apiId, t]));
  const lastPickByEntry = new Map<string, (typeof picks)[number]>();
  for (const p of picks) {
    const key = String(p.entryId);
    if (!lastPickByEntry.has(key)) lastPickByEntry.set(key, p);
  }

  return entriesSlice.map((e, i) => {
    const last = lastPickByEntry.get(String(e._id));
    const lastTeam = last?.teamApiId ? teamById.get(last.teamApiId) : null;
    return {
      rank: firstRank + i,
      name: nameById.get(String(e.userId)) ?? "Player",
      you: String(e.userId) === String(userId),
      survivedWeeks: survived(game.startMatchday, e.eliminatedAtMatchday ?? md),
      status: e.status,
      // Wildcard picks carry a team now; "WC" is only the legacy teamless form.
      lastTeamTla: lastTeam?.tla ?? (last?.isWildcard ? "WC" : null),
      lastTeamName: lastTeam?.name ?? (last?.isWildcard ? "Wildcard" : null),
      lastTeamCrest: lastTeam?.crest ?? null,
    };
  });
}

/** One page of the current game's standings, ranked and sorted in the DB. */
async function standingsPageForGame(
  game: HydratedDocument<IGame>,
  userId: string,
  offset: number,
  limit: number
): Promise<StandingsPage> {
  const [total, pageEntries] = await Promise.all([
    Entry.countDocuments({ gameId: game._id }),
    Entry.aggregate<IEntry>([
      { $match: { gameId: game._id } },
      { $addFields: STANDINGS_SORT_FIELDS },
      { $sort: { outRank: 1, elimSort: -1, createdAt: 1 } },
      { $skip: offset },
      { $limit: limit },
    ]),
  ]);
  const rows = await buildStandingRows(game, pageEntries, userId, offset + 1);
  return { total, offset, rows };
}

/** The player's own row with its true rank — pinned on top of the board. */
async function myStandingRow(
  game: HydratedDocument<IGame>,
  entry: HydratedDocument<IEntry>,
  userId: string
): Promise<StandingRow> {
  const myOut = entry.status === "alive" ? 0 : 1;
  const myElim = entry.eliminatedAtMatchday ?? 9999;
  const ahead = await Entry.aggregate<{ n: number }>([
    { $match: { gameId: game._id } },
    { $addFields: STANDINGS_SORT_FIELDS },
    {
      $match: {
        $expr: {
          $or: [
            { $lt: ["$outRank", myOut] },
            { $and: [{ $eq: ["$outRank", myOut] }, { $gt: ["$elimSort", myElim] }] },
            {
              $and: [
                { $eq: ["$outRank", myOut] },
                { $eq: ["$elimSort", myElim] },
                { $lt: ["$createdAt", entry.createdAt] },
              ],
            },
          ],
        },
      },
    },
    { $count: "n" },
  ]);
  const rank = (ahead[0]?.n ?? 0) + 1;
  const [row] = await buildStandingRows(game, [entry.toObject()], userId, rank);
  return row;
}

/** Public entry point for the lazy-loading board: one page of standings. */
export async function getStandingsPage(
  userId: string,
  offset: number,
  limit: number
): Promise<StandingsPage> {
  await connectDB();
  const game = await getCurrentGame();
  if (!game) return { total: 0, offset: 0, rows: [] };
  return standingsPageForGame(game, userId, offset, limit);
}

/**
 * Live pick counts — and who is behind each one — for the week currently
 * being picked. Fully public by design: everyone sees the same board while
 * deciding, so nobody feels a result came out of nowhere.
 *
 * `playersPerTeam` caps the names carried per team (the compact dashboard/
 * make-selection boards show a few + "+N more"); `count` always reflects the
 * full number, so at thousands of players the payload stays small. Omit it
 * for the full roster (the /picks breakdown page).
 */
export async function getPickSummary(
  opts: { playersPerTeam?: number } = {}
): Promise<PickSummary | null> {
  await connectDB();
  const game = await getCurrentGame();
  if (!game) return null;

  const window = await getPickWindow(game.season, game.currentMatchday);
  const pickMd = window.matchday;

  const [picks, teams] = await Promise.all([
    Pick.find({ gameId: game._id, matchday: pickMd, teamApiId: { $ne: null } })
      .select("teamApiId userId")
      .lean(),
    Team.find({}).lean(),
  ]);
  const users = await User.find({ _id: { $in: picks.map((p) => p.userId) } })
    .select("name firstName lastName")
    .lean();
  const nameById = new Map(users.map((u) => [String(u._id), publicName(u)]));
  const teamById = new Map(teams.map((t) => [t.apiId, t]));

  const playersByTeam = new Map<number, string[]>();
  for (const p of picks) {
    if (p.teamApiId == null || !teamById.has(p.teamApiId)) continue;
    const list = playersByTeam.get(p.teamApiId) ?? [];
    list.push(nameById.get(String(p.userId)) ?? "Player");
    playersByTeam.set(p.teamApiId, list);
  }

  const rows = [...playersByTeam.entries()]
    .map(([apiId, players]) => {
      const t = teamById.get(apiId)!;
      const sorted = players.sort((a, b) => a.localeCompare(b));
      return {
        teamApiId: t.apiId,
        name: t.name,
        shortName: t.shortName,
        tla: t.tla,
        crest: t.crest ?? null,
        count: sorted.length,
        players: opts.playersPerTeam != null ? sorted.slice(0, opts.playersPerTeam) : sorted,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    gameWeek: pickMd - game.startMatchday + 1,
    matchday: pickMd,
    totalPicks: rows.reduce((sum, r) => sum + r.count, 0),
    teams: rows,
  };
}

/** Everything the player-facing screens need for the current game. */
export async function getGameStateForUser(userId: string): Promise<PortalState> {
  await connectDB();
  const game = await getCurrentGame();
  if (!game) {
    return {
      game: null,
      entry: null,
      deadline: null,
      locked: false,
      pickMatchday: 0,
      pickGameWeek: 0,
      pickAhead: false,
      players: { total: 0, alive: 0 },
      teams: [],
      myPick: null,
      standings: [],
      standingsTotal: 0,
      myStanding: null,
      history: [],
    };
  }

  const md = game.currentMatchday;
  const gameNo = await Game.countDocuments({ createdAt: { $lte: game.createdAt } });
  const gameWeek = md - game.startMatchday + 1;

  // The week players actually pick for: the current week, or — once it has
  // kicked off — the next game week, however far ahead it sits.
  const pick = await getPickWindow(game.season, md);
  const pickMd = pick.matchday;
  const pickGameWeek = pickMd - game.startMatchday + 1;

  const [teams, fixtures, entry, playersTotal, playersAlive] = await Promise.all([
    Team.find({}).lean(),
    Fixture.find({ season: game.season, matchday: pickMd }).lean(),
    Entry.findOne({ gameId: game._id, userId }),
    Entry.countDocuments({ gameId: game._id }),
    Entry.countDocuments({ gameId: game._id, status: "alive" }),
  ]);
  const deadline = pick.deadline;

  const teamById = new Map(teams.map((t) => [t.apiId, t]));

  // Build the pickable team list for this matchday. "Used" teams are derived
  // from the entry's pick rows — the unique index there is the source of truth.
  const usedTeamIds = entry
    ? await Pick.distinct("teamApiId", { entryId: entry._id, teamApiId: { $ne: null } })
    : [];
  const usedSet = new Set<number>(usedTeamIds as number[]);
  const teamOptions: TeamOption[] = [];
  for (const f of fixtures) {
    const home = teamById.get(f.homeTeamApiId);
    const away = teamById.get(f.awayTeamApiId);
    if (home) {
      teamOptions.push({
        apiId: home.apiId,
        name: home.name,
        shortName: home.shortName,
        tla: home.tla,
        crest: home.crest,
        opponent: away?.shortName ?? "TBD",
        venue: "H",
        fixtureApiId: f.apiId,
        used: usedSet.has(home.apiId),
      });
    }
    if (away) {
      teamOptions.push({
        apiId: away.apiId,
        name: away.name,
        shortName: away.shortName,
        tla: away.tla,
        crest: away.crest,
        opponent: home?.shortName ?? "TBD",
        venue: "A",
        fixtureApiId: f.apiId,
        used: usedSet.has(away.apiId),
      });
    }
  }
  teamOptions.sort((a, b) => a.name.localeCompare(b.name));

  // The player's pick for the week they can currently pick.
  let myPick: PortalState["myPick"] = null;
  if (entry) {
    const current = await Pick.findOne({ entryId: entry._id, matchday: pickMd }).lean();
    if (current) {
      myPick = {
        teamApiId: current.teamApiId,
        teamName: current.teamApiId ? teamById.get(current.teamApiId)?.name ?? null : null,
        isWildcard: current.isWildcard,
        result: current.result,
      };
    }
  }

  // Standings: first page only — the board lazy-loads the rest — plus the
  // player's own ranked row so the UI can pin it on top.
  const [standingsPage, myStanding] = await Promise.all([
    standingsPageForGame(game, userId, 0, STANDINGS_PAGE_SIZE),
    entry ? myStandingRow(game, entry, userId) : Promise.resolve(null),
  ]);

  // History (this player's picks).
  let history: PortalState["history"] = [];
  if (entry) {
    const picks = await Pick.find({ entryId: entry._id }).sort({ matchday: 1 }).lean();
    history = picks.map((p) => {
      const team = p.teamApiId ? teamById.get(p.teamApiId) : null;
      return {
        matchday: p.matchday,
        gameWeek: p.matchday - game.startMatchday + 1,
        teamName: team?.name ?? null,
        tla: team?.tla ?? null,
        crest: team?.crest ?? null,
        result: p.result,
        isWildcard: p.isWildcard,
      };
    });
  }

  return {
    game: {
      id: String(game._id),
      no: gameNo,
      status: game.status,
      season: game.season,
      matchday: md,
      gameWeek,
    },
    entry: entry
      ? {
          status: entry.status,
          wildcardUsed: entry.wildcardUsed,
          survivedWeeks: survived(game.startMatchday, entry.eliminatedAtMatchday ?? md),
        }
      : null,
    deadline: deadline ? deadline.toISOString() : null,
    locked: pick.locked,
    pickMatchday: pickMd,
    pickGameWeek,
    pickAhead: pick.ahead,
    players: {
      total: playersTotal,
      alive: playersAlive,
    },
    teams: teamOptions,
    myPick,
    standings: standingsPage.rows,
    standingsTotal: standingsPage.total,
    myStanding,
    history,
  };
}
