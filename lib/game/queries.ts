import { type Types, type HydratedDocument } from "mongoose";
import { connectDB } from "@/database/connect";
import { Game, type IGame } from "@/models/Game";
import { Entry, type IEntry } from "@/models/Entry";
import { Pick } from "@/models/Pick";
import { Team } from "@/models/Team";
import { Fixture } from "@/models/Fixture";
import { User } from "@/models/User";
import { getMatchdayDeadline, isLocked } from "./deadline";
import { GameError } from "./errors";
import type { TeamOption, PortalState, AdminOverview } from "./portalTypes";

export type { TeamOption, PortalState, AdminOverview } from "./portalTypes";

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
  const winners = await User.find({ _id: { $in: winnerIds } }).select("name").lean();
  const winnerName = new Map(winners.map((w) => [String(w._id), w.name]));

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
      players: { total: 0, alive: 0 },
      teams: [],
      myPick: null,
      standings: [],
      history: [],
    };
  }

  const md = game.currentMatchday;
  const gameNo = await Game.countDocuments({ createdAt: { $lte: game.createdAt } });
  const gameWeek = md - game.startMatchday + 1;

  const [teams, fixtures, entry, entries, deadline] = await Promise.all([
    Team.find({}).lean(),
    Fixture.find({ season: game.season, matchday: md }).lean(),
    Entry.findOne({ gameId: game._id, userId }),
    Entry.find({ gameId: game._id }).lean(),
    getMatchdayDeadline(game.season, md),
  ]);

  const teamById = new Map(teams.map((t) => [t.apiId, t]));

  // Build the pickable team list for this matchday.
  const usedSet = new Set(entry?.usedTeamApiIds ?? []);
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

  // Current pick.
  let myPick: PortalState["myPick"] = null;
  if (entry) {
    const pick = await Pick.findOne({ entryId: entry._id, matchday: md }).lean();
    if (pick) {
      myPick = {
        teamApiId: pick.teamApiId,
        teamName: pick.teamApiId ? teamById.get(pick.teamApiId)?.name ?? null : null,
        isWildcard: pick.isWildcard,
        result: pick.result,
      };
    }
  }

  // Standings.
  const userIds = entries.map((e) => e.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("name")
    .lean();
  const nameById = new Map(users.map((u) => [String(u._id), u.name]));
  const lastPicks = await Pick.find({ gameId: game._id })
    .sort({ matchday: -1 })
    .lean();
  const lastPickByEntry = new Map<string, (typeof lastPicks)[number]>();
  for (const p of lastPicks) {
    const key = String(p.entryId);
    if (!lastPickByEntry.has(key)) lastPickByEntry.set(key, p);
  }

  const standings = entries
    .map((e) => {
      const last = lastPickByEntry.get(String(e._id));
      const lastTeam = last?.teamApiId ? teamById.get(last.teamApiId) : null;
      return {
        name: nameById.get(String(e.userId)) ?? "Player",
        you: String(e.userId) === String(userId),
        survivedWeeks: survived(game.startMatchday, e.eliminatedAtMatchday ?? md),
        status: e.status,
        lastTeamTla: last?.isWildcard ? "WC" : lastTeam?.tla ?? null,
        lastTeamName: last?.isWildcard ? "Wildcard" : lastTeam?.name ?? null,
        lastTeamCrest: last?.isWildcard ? null : lastTeam?.crest ?? null,
      };
    })
    .sort((a, b) => {
      // alive first, then by weeks survived desc
      if (a.status === "alive" && b.status !== "alive") return -1;
      if (b.status === "alive" && a.status !== "alive") return 1;
      return b.survivedWeeks - a.survivedWeeks;
    });

  // History (this player's picks).
  let history: PortalState["history"] = [];
  if (entry) {
    const picks = await Pick.find({ entryId: entry._id }).sort({ matchday: 1 }).lean();
    history = picks.map((p) => {
      const team = p.teamApiId ? teamById.get(p.teamApiId) : null;
      return {
        matchday: p.matchday,
        gameWeek: p.matchday - game.startMatchday + 1,
        teamName: p.isWildcard ? null : team?.name ?? null,
        tla: p.isWildcard ? null : team?.tla ?? null,
        crest: p.isWildcard ? null : team?.crest ?? null,
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
    locked: isLocked(deadline),
    players: {
      total: entries.length,
      alive: entries.filter((e) => e.status === "alive").length,
    },
    teams: teamOptions,
    myPick,
    standings,
    history,
  };
}
