import { connectDB } from "@/database/connect";
import { Game } from "@/models/Game/Game";
import { Entry } from "@/models/Game/Entry";
import { GameError } from "./errors";

/** Join the current game. Only allowed while the game is in registration. */
export async function joinGame(userId: string): Promise<void> {
  await connectDB();
  const game = await Game.findOne({ status: "registration" }).sort({ createdAt: -1 });
  if (!game) throw new GameError("Registration isn’t open right now.", 409);

  const existing = await Entry.findOne({ gameId: game._id, userId });
  if (existing) return; // already joined — idempotent

  try {
    await Entry.create({ gameId: game._id, userId, status: "alive" });
  } catch (err) {
    // Unique (gameId, userId) race — treat as already joined.
    const again = await Entry.findOne({ gameId: game._id, userId });
    if (!again) throw err;
  }
}
