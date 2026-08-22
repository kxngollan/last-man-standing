import { type Types, type HydratedDocument } from "mongoose";
import { connectDB } from "@/database/connect";
import { Game, type IGame } from "@/models/Game/Game";
import { Entry, type IEntry } from "@/models/Game/Entry";
import { Pick } from "@/models/Game/Pick";
import { Team } from "@/models/Teams/Team";
import { loadTeams } from "./teams";
import { Fixture } from "@/models/Teams/Fixture";
import { User } from "@/models/User/User";
import { publicName } from "@/lib/displayName";
import { getMatchdayDeadline, isLocked } from "./deadline";
import { getPickWindow, type PickWindow } from "./pickWindow";
import { livePickState, pickState, liveDetail } from "./scoring";
import { getUndoableResolution } from "./resolve";
import { GameError } from "./errors";
import type {
  TeamOption,
  PortalState,
  AdminOverview,
  StandingRow,
  StandingsPage,
  PickSummary,
  StandingPick,
  LivePickState,
  WeekState,
  WeekOption,
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

/** Game weeks cleared: the standings number, and profiles must agree with it. */
export const survived = (startMatchday: number, upto: number) => Math.max(0, upto - startMatchday);

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

  // The undo target: offered even when the game is finished, because a
  // resolution that ended the game leaves `current` null. A finished game
  // can't be reopened while a newer game is open, so don't offer an undo that
  // would only be refused.
  const undoable = await getUndoableResolution();
  const blocked = !!undoable && !!current && current.id !== String(undoable.game._id);
  const recovery =
    undoable && !blocked
      ? {
          gameId: String(undoable.game._id),
          no: await Game.countDocuments({ createdAt: { $lte: undoable.game.createdAt } }),
          gameWeek: undoable.matchday - undoable.game.startMatchday + 1,
          matchday: undoable.matchday,
          endedGame: undoable.game.status === "finished",
        }
      : null;

  return { current, pastGames, teamsSeeded, recovery };
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

/**
 * Build display rows for a slice of entries (already in rank order).
 *
 * `weekMatchday` is the one game week the board is showing. Rows carry that
 * week's pick and nothing else: with two weeks live at once, a row built from
 * a player's newest pick shows next week's team as if it were this week's.
 */
async function buildStandingRows(
  game: HydratedDocument<IGame>,
  entriesSlice: IEntry[],
  userId: string,
  firstRank: number,
  weekMatchday: number
): Promise<StandingRow[]> {
  const md = game.currentMatchday;
  const entryIds = entriesSlice.map((e) => e._id);
  const userIds = entriesSlice.map((e) => e.userId);

  // Picks are fully public by design — including the open week's — so every
  // player sees the same board and nobody wonders where a result came from.
  const [users, teams, picks, fixtures] = await Promise.all([
    User.find({ _id: { $in: userIds } })
      .select("name firstName lastName")
      .lean(),
    loadTeams(),
    Pick.find({ entryId: { $in: entryIds } })
      .sort({ matchday: -1 })
      .lean(),
    Fixture.find({ season: game.season, matchday: weekMatchday }).lean(),
  ]);
  // Standings are public — show "First L.", never the full surname.
  const nameById = new Map(users.map((u) => [String(u._id), publicName(u)]));
  const teamById = new Map(teams.map((t) => [t.apiId, t]));
  const fixtureById = new Map(fixtures.map((f) => [f.apiId, f]));
  const pickByEntry = new Map<string, (typeof picks)[number]>();
  for (const p of picks) {
    if (p.matchday === weekMatchday) pickByEntry.set(String(p.entryId), p);
  }

  const toStandingPick = (p: (typeof picks)[number]): StandingPick => {
    const team = p.teamApiId ? teamById.get(p.teamApiId) : null;
    return {
      matchday: p.matchday,
      gameWeek: p.matchday - game.startMatchday + 1,
      // Wildcard picks carry a team now; "WC" is only the legacy teamless form.
      teamName: team?.name ?? (p.isWildcard ? "Wildcard" : null),
      tla: team?.tla ?? (p.isWildcard ? "WC" : null),
      crest: team?.crest ?? null,
      isWildcard: p.isWildcard,
      state: pickState(p, p.fixtureApiId ? fixtureById.get(p.fixtureApiId) : undefined),
    };
  };

  return entriesSlice.map((e, i) => {
    const mine = pickByEntry.get(String(e._id));
    // A pick-ahead row from a player already out of the game is void — never
    // show it as the team they're on.
    const void_ = !!mine && e.status === "eliminated" && weekMatchday > (e.eliminatedAtMatchday ?? 0);
    const pick = mine && !void_ ? toStandingPick(mine) : null;

    return {
      rank: firstRank + i,
      name: nameById.get(String(e.userId)) ?? "Player",
      userId: String(e.userId),
      you: String(e.userId) === String(userId),
      survivedWeeks: survived(game.startMatchday, e.eliminatedAtMatchday ?? md),
      status: e.status,
      pick,
      lastTeamTla: pick?.tla ?? null,
      lastTeamName: pick?.teamName ?? null,
      lastTeamCrest: pick?.crest ?? null,
    };
  });
}

/** One page of the current game's standings, ranked and sorted in the DB. */
async function standingsPageForGame(
  game: HydratedDocument<IGame>,
  userId: string,
  offset: number,
  limit: number,
  weekMatchday: number
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
  const rows = await buildStandingRows(game, pageEntries, userId, offset + 1, weekMatchday);
  return { total, offset, rows };
}

/**
 * Where one entry sits in its game — the number of entries ranked ahead of it,
 * plus one. Same ordering as the board, so a profile's placing and the
 * standings never disagree. Takes plain fields so lean docs work too.
 */
export async function rankOfEntry(
  gameId: Types.ObjectId,
  // Spelled out rather than Pick<IEntry, …> — `Pick` is the model in this file.
  entry: { status: IEntry["status"]; eliminatedAtMatchday: number | null; createdAt: Date }
): Promise<number> {
  const myOut = entry.status === "alive" ? 0 : 1;
  const myElim = entry.eliminatedAtMatchday ?? 9999;
  const ahead = await Entry.aggregate<{ n: number }>([
    { $match: { gameId } },
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
  return (ahead[0]?.n ?? 0) + 1;
}

/** The player's own row with its true rank — pinned on top of the board. */
async function myStandingRow(
  game: HydratedDocument<IGame>,
  entry: HydratedDocument<IEntry>,
  userId: string,
  weekMatchday: number
): Promise<StandingRow> {
  const rank = await rankOfEntry(game._id, entry);
  const [row] = await buildStandingRows(game, [entry.toObject()], userId, rank, weekMatchday);
  return row;
}

/** Public entry point for the lazy-loading board: one page of standings. */
export async function getStandingsPage(
  userId: string,
  offset: number,
  limit: number,
  /** Game week to show picks for. Defaults to the week being played. */
  gameWeek?: number
): Promise<StandingsPage> {
  await connectDB();
  const game = await getCurrentGame();
  if (!game) return { total: 0, offset: 0, rows: [] };
  return standingsPageForGame(
    game,
    userId,
    offset,
    limit,
    await weekMatchdayFor(game, gameWeek)
  );
}

/**
 * Live pick counts — and who is behind each one — for one game week. Fully
 * public by design: everyone sees the same board while deciding, so nobody
 * feels a result came out of nowhere.
 *
 * One board is one week. A player only appears on it if they can actually be
 * in that week: anyone out of the game is left off, and on a week that hasn't
 * started yet so is anyone the week being played has already knocked out —
 * their pick-ahead row is void. Whoever is left carries their live state, so
 * the board separates the players guaranteed to be there ("safe") from those
 * still playing for their place ("pending").
 *
 * `playersPerTeam` caps the names carried per team (the compact dashboard/
 * make-selection boards show a few + "+N more"); `count` always reflects the
 * full number, so at thousands of players the payload stays small. Omit it
 * for the full roster (the /picks breakdown page).
 */
async function buildWeekBoard(
  game: HydratedDocument<IGame>,
  md: number,
  window: PickWindow,
  opts: { playersPerTeam?: number; withState?: boolean } = {}
): Promise<PickSummary> {
  const inPlayMd = game.currentMatchday;
  const state: WeekState = md < inPlayMd ? "played" : md === inPlayMd ? "in-play" : "open";
  // Anything before the open window has had its deadline pass.
  const locked = md < window.matchday ? true : window.locked;

  const [picks, teams, entries, fixtures] = await Promise.all([
    Pick.find({
      gameId: game._id,
      matchday: state === "open" ? { $in: [md, inPlayMd] } : md,
      teamApiId: { $ne: null },
    })
      .select("entryId userId matchday teamApiId fixtureApiId isWildcard result")
      .lean(),
    loadTeams(),
    Entry.find({ gameId: game._id }).select("status").lean(),
    Fixture.find({
      season: game.season,
      matchday: state === "open" ? { $in: [md, inPlayMd] } : md,
    }).lean(),
  ]);

  const weekPicks = picks.filter((p) => p.matchday === md);
  const users = await User.find({ _id: { $in: weekPicks.map((p) => p.userId) } })
    .select("name firstName lastName")
    .lean();
  const nameById = new Map(users.map((u) => [String(u._id), publicName(u)]));
  const teamById = new Map(teams.map((t) => [t.apiId, t]));
  const statusByEntry = new Map(entries.map((e) => [String(e._id), e.status]));
  const fixtureById = new Map(fixtures.map((f) => [f.apiId, f]));
  // The week being played decides who is still in a later week.
  const inPlayPickByEntry = new Map(
    picks.filter((p) => p.matchday === inPlayMd).map((p) => [String(p.entryId), p])
  );

  const rosterByTeam = new Map<
    number,
    Array<{ name: string; state: LivePickState; isWildcard: boolean }>
  >();
  const counts = { safe: 0, pending: 0, out: 0 };
  let excluded = 0;

  for (const p of weekPicks) {
    if (p.teamApiId == null || !teamById.has(p.teamApiId)) continue;

    // A week already played is history: everyone who was on it belongs on it,
    // including the players it knocked out. Only a week still to come drops
    // players who can't be in it.
    if (state !== "played" && statusByEntry.get(String(p.entryId)) === "eliminated") {
      excluded++;
      continue;
    }

    let live: LivePickState;
    if (state !== "open") {
      live = pickState(p, p.fixtureApiId ? fixtureById.get(p.fixtureApiId) : undefined);
    } else {
      // A later week: their place in it depends on the week being played.
      const running = inPlayPickByEntry.get(String(p.entryId));
      live = running
        ? pickState(running, running.fixtureApiId ? fixtureById.get(running.fixtureApiId) : undefined)
        : "pending";
      if (live === "out") {
        excluded++; // knocked out before this week starts — not in it
        continue;
      }
    }

    counts[live]++;
    const list = rosterByTeam.get(p.teamApiId) ?? [];
    list.push({
      name: nameById.get(String(p.userId)) ?? "Player",
      state: live,
      // Public on purpose: a wildcard changes what a draw means for that
      // player, so everyone reading the board should see it.
      isWildcard: p.isWildcard,
    });
    rosterByTeam.set(p.teamApiId, list);
  }

  const rows = [...rosterByTeam.entries()]
    .map(([apiId, roster]) => {
      const t = teamById.get(apiId)!;
      // Grouped by state — through, then out, then still to play — each
      // alphabetical. Boards render one line per group and cap the names, so
      // ordering this way keeps every line populated instead of spending the
      // whole allowance on one of them.
      const order = { safe: 0, out: 1, pending: 2 } as const;
      const sorted = roster.sort(
        (a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name)
      );
      const shown = opts.playersPerTeam != null ? sorted.slice(0, opts.playersPerTeam) : sorted;
      // Counted over everyone on the team, not just the names that fit.
      const teamCounts = { safe: 0, out: 0, pending: 0 };
      let wildcards = 0;
      for (const r of sorted) {
        teamCounts[r.state]++;
        if (r.isWildcard) wildcards++;
      }
      return {
        teamApiId: t.apiId,
        name: t.name,
        shortName: t.shortName,
        tla: t.tla,
        crest: t.crest ?? null,
        count: sorted.length,
        counts: teamCounts,
        wildcards,
        players: shown.map((r) => r.name),
        ...(opts.withState ? { roster: shown } : {}),
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    gameWeek: md - game.startMatchday + 1,
    matchday: md,
    totalPicks: rows.reduce((sum, r) => sum + r.count, 0),
    state,
    locked,
    counts,
    excluded,
    teams: rows,
  };
}

/**
 * One week's board. Defaults to the week that's open for picks.
 *
 * `gameWeek` is the player-facing week number (week 1 is the game's first),
 * clamped to the weeks that exist: nothing past the week now open for picks,
 * since a later one has no picks to show and isn't a player's business yet.
 */
export async function getPickSummary(
  opts: {
    matchday?: number;
    gameWeek?: number;
    playersPerTeam?: number;
    withState?: boolean;
  } = {}
): Promise<PickSummary | null> {
  await connectDB();
  const game = await getCurrentGame();
  if (!game) return null;
  const window = await getPickWindow(game.season, game.currentMatchday);
  const md =
    opts.matchday != null
      ? Math.min(Math.max(opts.matchday, game.startMatchday), window.matchday)
      : opts.gameWeek != null
        ? await weekMatchdayFor(game, opts.gameWeek)
        : window.matchday;
  return buildWeekBoard(game, md, window, opts);
}

/**
 * Turn a player-facing game week into a matchday, clamped to the weeks that
 * exist: never before the game's first, never past the week now open for
 * picks. Undefined means the week being played — "this week".
 */
async function weekMatchdayFor(
  game: HydratedDocument<IGame>,
  gameWeek?: number
): Promise<number> {
  if (gameWeek == null) return game.currentMatchday;
  const window = await getPickWindow(game.season, game.currentMatchday);
  const asked = game.startMatchday + gameWeek - 1;
  return Math.min(Math.max(asked, game.startMatchday), Math.max(window.matchday, game.currentMatchday));
}

/**
 * Every game week a player can look at, in order: each week played so far, the
 * one being played, and the next one once it opens for picks. Cheap — no picks
 * are read. This is what the week buttons are built from, and screens show one
 * of these weeks at a time, never two at once.
 */
export async function getWeekOptions(): Promise<WeekOption[]> {
  await connectDB();
  const game = await getCurrentGame();
  if (!game) return [];
  const window = await getPickWindow(game.season, game.currentMatchday);
  const last = Math.max(game.currentMatchday, window.matchday);
  const options: WeekOption[] = [];
  for (let md = game.startMatchday; md <= last; md++) {
    options.push({
      matchday: md,
      gameWeek: md - game.startMatchday + 1,
      state:
        md < game.currentMatchday ? "played" : md === game.currentMatchday ? "in-play" : "open",
      locked: md < window.matchday ? true : window.locked,
    });
  }
  return options;
}

/** Everything the player-facing screens need for the current game. */
export async function getGameStateForUser(
  userId: string,
  /** `standingsWeek` scopes the standings' pick column to one game week. */
  opts: { standingsWeek?: number } = {}
): Promise<PortalState> {
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
      liveWeek: null,
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
    loadTeams(),
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
  const standingsMd = await weekMatchdayFor(game, opts.standingsWeek);
  const [standingsPage, myStanding] = await Promise.all([
    standingsPageForGame(game, userId, 0, STANDINGS_PAGE_SIZE, standingsMd),
    entry ? myStandingRow(game, entry, userId, standingsMd) : Promise.resolve(null),
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

  // Where the player stands in the week being played, read straight off the
  // fixtures. This is the answer to "am I safe?" during the week — the
  // resolution only writes down what this already knows.
  let liveWeek: PortalState["liveWeek"] = null;
  if (entry) {
    const myRunning = await Pick.findOne({ entryId: entry._id, matchday: md }).lean();
    if (myRunning) {
      const fixture = myRunning.fixtureApiId
        ? await Fixture.findOne({ apiId: myRunning.fixtureApiId }).lean()
        : null;
      const live = livePickState(myRunning, fixture);
      const team = myRunning.teamApiId ? teamById.get(myRunning.teamApiId) : null;
      const score =
        fixture && fixture.homeScore != null && fixture.awayScore != null
          ? myRunning.teamApiId === fixture.homeTeamApiId
            ? `${fixture.homeScore}–${fixture.awayScore}`
            : `${fixture.awayScore}–${fixture.homeScore}`
          : null;

      liveWeek = {
        matchday: md,
        gameWeek,
        teamName: team?.name ?? null,
        tla: team?.tla ?? null,
        crest: team?.crest ?? null,
        isWildcard: myRunning.isWildcard,
        state: live.state,
        detail: liveDetail(live, {
          teamName: team?.name ?? null,
          isWildcard: myRunning.isWildcard,
          score,
        }),
        kickoff:
          live.state === "pending" && fixture?.utcKickoff
            ? new Date(fixture.utcKickoff).toISOString()
            : null,
        score,
      };
    }
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
    liveWeek,
  };
}
