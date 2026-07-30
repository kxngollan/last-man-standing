import { connectDB } from "@/database/connect";
import { Game, type IGame } from "@/models/Game";
import { syncFixtures } from "@/lib/football-api/sync";
import { DEFAULT_SEASON } from "./constants";
import { GameError } from "./errors";
import type { HydratedDocument } from "mongoose";

/** Create a new global game in registration. Fails if a game is already open. */
export async function createGame(params: {
  createdBy: string;
  startMatchday: number;
  season?: number;
}): Promise<HydratedDocument<IGame>> {
  await connectDB();
  const open = await Game.findOne({ status: { $in: ["registration", "active"] } });
  if (open) {
    throw new GameError("A game is already open. Finish it before starting another.", 409);
  }
  const season = params.season ?? DEFAULT_SEASON;
  return Game.create({
    status: "registration",
    season,
    startMatchday: params.startMatchday,
    currentMatchday: params.startMatchday,
    createdBy: params.createdBy,
  });
}

/** Close registration and kick off game week 1 (syncs its fixtures). */
export async function startGame(gameId: string): Promise<void> {
  await connectDB();
  const game = await Game.findById(gameId);
  if (!game) throw new GameError("Game not found.", 404);
  if (game.status !== "registration") {
    throw new GameError("This game isn’t in registration.", 409);
  }
  await syncFixtures(game.season, game.startMatchday);
  game.status = "active";
  game.currentMatchday = game.startMatchday;
  await game.save();
}
