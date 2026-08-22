import { connectDB } from "@/database/connect";
import { Game } from "@/models/Game/Game";
import { Entry } from "@/models/Game/Entry";
import { Pick } from "@/models/Game/Pick";
import { Team } from "@/models/Teams/Team";
import { User } from "@/models/User/User";
import { sendResultEmail, type ResultEmailKind } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { GameError } from "./errors";

/**
 * How many emails one run will send. A run is resumable — every send is
 * stamped on the entry — so a big game just takes a second click rather than
 * hitting a serverless timeout mid-flight.
 */
const MAX_PER_RUN = 250;

/** Concurrent sends. Enough to be quick, gentle enough for a shared SMTP relay. */
const CONCURRENCY = 5;

export interface NotifyResult {
  matchday: number;
  gameWeek: number;
  /** Emails accepted by the SMTP server. */
  sent: number;
  /** Players already told about this week (or with no address to write to). */
  skipped: number;
  /** Sends that failed — they keep no stamp, so the next run retries them. */
  failed: number;
  /** Still to email after this run, when the per-run cap was reached. */
  remaining: number;
}

/** Run `task` over `items`, at most `limit` in flight at once. */
async function mapLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      await task(items[next++]);
    }
  });
  await Promise.all(workers);
}

/**
 * Email every player the verdict on a resolved game week: through, out, won,
 * or all-out. Reads the outcome off the entries the resolver already wrote —
 * it never decides anything itself, so it can be run late, run twice, or run
 * again after an undo-and-re-resolve without contradicting the game state.
 *
 * `matchday` defaults to the week the game last resolved: the week before the
 * one now being awaited, or — for a game the resolution ended — the last week
 * played, which is where `currentMatchday` stopped.
 */
export async function notifyMatchdayResults(
  gameId: string,
  matchday?: number
): Promise<NotifyResult> {
  await connectDB();
  const game = await Game.findById(gameId);
  if (!game) throw new GameError("Game not found.", 404);
  if (game.status === "registration") {
    throw new GameError("This game hasn’t started yet — there are no results to send.", 409);
  }

  const md = matchday ?? (game.status === "finished" ? game.currentMatchday : game.currentMatchday - 1);
  if (md < game.startMatchday) {
    throw new GameError("No game week has been resolved yet.", 409);
  }
  const gameWeek = md - game.startMatchday + 1;

  // Everyone who went into that week: still standing, knocked out by it, or
  // crowned by it. Players eliminated in an earlier week have already had
  // their email and hear nothing more.
  const entries = await Entry.find({
    gameId: game._id,
    $or: [
      { status: { $in: ["alive", "winner"] } },
      { status: "eliminated", eliminatedAtMatchday: md },
    ],
  }).lean();

  const [users, picks, teams, playersLeft] = await Promise.all([
    User.find({ _id: { $in: entries.map((e) => e.userId) } })
      .select("email banned")
      .lean(),
    Pick.find({ gameId: game._id, matchday: md }).select("entryId teamApiId").lean(),
    Team.find({}).select("apiId name").lean(),
    Entry.countDocuments({ gameId: game._id, status: { $in: ["alive", "winner"] } }),
  ]);

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const teamName = new Map(teams.map((t) => [t.apiId, t.name]));
  const pickTeam = new Map(
    picks.map((p) => [String(p.entryId), p.teamApiId == null ? null : teamName.get(p.teamApiId) ?? null])
  );

  let skipped = 0;
  const queue: Array<{ entryId: string; to: string; kind: ResultEmailKind; team: string | null }> = [];

  for (const entry of entries) {
    // Already told about this week, or nowhere to write to.
    const user = userById.get(String(entry.userId));
    if (entry.resultEmailedMatchday === md || !user?.email || user.banned) {
      skipped++;
      continue;
    }
    const kind: ResultEmailKind =
      entry.status === "winner"
        ? "winner"
        : entry.status === "alive"
          ? "through"
          : game.noWinner
            ? "all-out"
            : "out";
    queue.push({
      entryId: String(entry._id),
      to: user.email,
      kind,
      team: pickTeam.get(String(entry._id)) ?? null,
    });
  }

  const batch = queue.slice(0, MAX_PER_RUN);
  let sent = 0;
  let failed = 0;

  await mapLimit(batch, CONCURRENCY, async (job) => {
    try {
      await sendResultEmail(job.to, `${SITE_URL}/dashboard`, {
        kind: job.kind,
        gameWeek,
        teamName: job.team,
        playersLeft,
      });
      // Stamped only on success, one at a time: a run that dies halfway
      // through has still recorded exactly who heard from us.
      await Entry.updateOne({ _id: job.entryId }, { $set: { resultEmailedMatchday: md } });
      sent++;
    } catch (err) {
      failed++;
      console.warn(`[notify] result email to ${job.to} failed:`, (err as Error).message);
    }
  });

  return { matchday: md, gameWeek, sent, skipped, failed, remaining: queue.length - batch.length };
}
