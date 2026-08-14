/**
 * Re-sync the Premier League teams, and nothing else.
 *
 *   npm run sync:teams
 *
 * `npm run seed` does this too, but it first creates player@dev.local and
 * admin@dev.local with a password that is printed in the README — fine on a
 * laptop, not something to run against the database a real game is running on.
 * This is the half of it that is safe anywhere: it touches the Team collection
 * and nothing else, creates no accounts, and writes no fixtures.
 *
 * Run it after scripts/pixelate-crests.py, which writes the badge files but
 * cannot put their paths on the teams. Until this has run, Team.pCrest is empty
 * and CREST_STYLE=pixel resolves to nothing, so every row shows the lettered
 * disc. See lib/crests.ts.
 *
 * Idempotent: it upserts the same 20 teams by apiId every time.
 */
import mongoose from "mongoose";
import { connectDB } from "@/database/connect";
import { Game } from "@/models/Game/Game";
import { Team } from "@/models/Teams/Team";
import { syncTeams } from "@/lib/football-api/sync";
import { DEFAULT_SEASON } from "@/lib/game/constants";
import { CREST_STYLE } from "@/lib/crests";

/**
 * Every season whose teams anyone can still see.
 *
 * Not just DEFAULT_SEASON: a game carries its own season, and the two drift
 * apart the moment a game is started on a newer one. Syncing only the default
 * leaves the season actually being played untouched — its promoted clubs keep
 * whatever a previous run gave them, which is how you end up with three teams
 * showing a lettered disc while the other seventeen have badges. Past seasons
 * stay in the list because the fixtures and table views can browse them.
 */
async function seasonsInUse(): Promise<number[]> {
  const games = await Game.find({}).select("season").lean();
  return [...new Set([...games.map((g) => g.season), DEFAULT_SEASON])].sort();
}

async function main() {
  if (!process.env.MONGO_DB_URI || !process.env.MONGO_DB_NAME) {
    console.error(
      "MONGO_DB_URI and MONGO_DB_NAME must be set.\n" +
        "Copy .env.example to .env.local and fill them in."
    );
    process.exit(1);
  }
  if (!process.env.FOOTBALL_API) {
    console.error("FOOTBALL_API is not set — there is nothing to sync from.");
    process.exit(1);
  }

  // Host without the credentials: enough to see which database you are about to
  // write to, which is the whole point of printing it.
  const host = process.env.MONGO_DB_URI.replace(/^mongodb(\+srv)?:\/\/([^@]*@)?/, "").split("/")[0];
  console.log(`Syncing teams into ${process.env.MONGO_DB_NAME} on ${host}`);

  await connectDB();
  const seasons = await seasonsInUse();
  console.log(`Seasons ${seasons.join(", ")} · CREST_STYLE=${CREST_STYLE}\n`);

  for (const season of seasons) {
    const count = await syncTeams(season);
    console.log(`  ${season}: ${count} teams`);
  }

  const total = await Team.countDocuments({});
  const withPixel = await Team.countDocuments({ pCrest: { $ne: null } });
  console.log(`\n  ${withPixel} of ${total} teams have a pixelated badge on Team.pCrest`);

  if (withPixel < total) {
    const bare = await Team.find({ pCrest: { $eq: null } }).select("tla").lean();
    console.log(
      `  no badge for: ${bare.map((t) => t.tla).join(", ") || "—"}\n` +
        "  Those rows show the lettered disc. To give them one, re-run\n" +
        `  scripts/pixelate-crests.py ${seasons.join(" ")} and then this script again.`
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nTeam sync failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
