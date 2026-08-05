/**
 * One-command local setup for contributors:
 *
 *   npm run seed
 *
 * What it does (idempotent — safe to re-run):
 *   1. Creates two verified dev accounts, skipping any that already exist:
 *        player@dev.local  (regular player)
 *        admin@dev.local   (admin — can seed/start games from /admin)
 *      Both use the password "password123" (override with SEED_PASSWORD).
 *   2. If FOOTBALL_API is set, syncs the Premier League teams and the full
 *      season's fixtures from football-data.org. Without a key this step is
 *      skipped — the fixtures/table pages will be empty until one is added.
 *
 * Requires .env.local with MONGO_DB_URI + MONGO_DB_NAME (see .env.example);
 * the npm script loads it via node's --env-file.
 *
 * Refuses to run with NODE_ENV=production unless --force is passed, so the
 * weak dev credentials can't land in a production database by accident.
 */
import { connectDB } from "@/database/connect";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Fixture } from "@/models/Fixture";
import { hashPassword } from "@/lib/password";
import { syncTeams, syncSeasonFixtures } from "@/lib/football-api/sync";
import { DEFAULT_SEASON } from "@/lib/game/constants";
import mongoose from "mongoose";

const PASSWORD = process.env.SEED_PASSWORD ?? "password123";

const DEV_USERS = [
  { email: "player@dev.local", firstName: "Dev", lastName: "Player", isAdmin: false },
  { email: "admin@dev.local", firstName: "Dev", lastName: "Admin", isAdmin: true },
];

async function ensureUser(u: (typeof DEV_USERS)[number]): Promise<"created" | "exists"> {
  const existing = await User.findOne({ email: u.email });
  if (existing) return "exists";
  await User.create({
    firstName: u.firstName,
    lastName: u.lastName,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    passwordHash: await hashPassword(PASSWORD),
    dob: new Date("1990-01-01"),
    emailVerified: true, // no inbox behind @dev.local — skip the email loop
    isAdmin: u.isAdmin,
  });
  return "created";
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error(
      "Refusing to seed with NODE_ENV=production — this creates dev accounts with a known password.\n" +
        "If you really mean it, re-run with --force."
    );
    process.exit(1);
  }

  if (!process.env.MONGO_DB_URI || !process.env.MONGO_DB_NAME) {
    console.error(
      "MONGO_DB_URI and MONGO_DB_NAME must be set.\n" +
        "Copy .env.example to .env.local and fill them in, then re-run `npm run seed`."
    );
    process.exit(1);
  }

  const host = process.env.MONGO_DB_URI.replace(/^mongodb(\+srv)?:\/\/([^@]*@)?/, "").split("/")[0];
  console.log(`Seeding ${process.env.MONGO_DB_NAME} on ${host}\n`);

  await connectDB();

  // 1 — dev accounts
  for (const u of DEV_USERS) {
    const outcome = await ensureUser(u);
    const role = u.isAdmin ? "admin " : "player";
    console.log(
      outcome === "created"
        ? `  ✓ ${role}  ${u.email}  (password: ${PASSWORD})`
        : `  · ${role}  ${u.email}  already exists — left untouched`
    );
  }

  // 2 — teams + fixtures
  if (process.env.FOOTBALL_API) {
    console.log(`\nSyncing Premier League data for season ${DEFAULT_SEASON} from football-data.org…`);
    const teams = await syncTeams(DEFAULT_SEASON);
    const fixtures = await syncSeasonFixtures(DEFAULT_SEASON);
    console.log(`  ✓ ${teams} teams · ${fixtures} fixtures`);
  } else {
    const [teams, fixtures] = await Promise.all([
      Team.countDocuments({}),
      Fixture.countDocuments({ season: DEFAULT_SEASON }),
    ]);
    console.log(
      `\nFOOTBALL_API not set — skipped the football-data.org sync ` +
        `(DB currently has ${teams} teams, ${fixtures} fixtures).\n` +
        "Get a free key at https://www.football-data.org/ to populate fixtures and the table."
    );
  }

  console.log(
    "\nDone. Next steps:\n" +
      "  · npm run dev\n" +
      "  · log in as admin@dev.local and start a game from /admin\n" +
      "  · log in as player@dev.local to play"
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nSeed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
