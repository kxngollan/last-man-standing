import { authedRoute, body, OPTIONS } from "@/lib/mobile/api";
import { feedbackSchema } from "@/lib/validation";
import { GameError } from "@/lib/game/errors";
import { connectDB } from "@/database/connect";
import { Feedback } from "@/models/Report/Feedback";
import { rateLimit } from "@/lib/rateLimit";

export { OPTIONS };

/** Rate the app, optionally with a comment. */
export const POST = authedRoute(async (me, request) => {
  // Awaited, unlike the web route — see the note in app/api/feedback/route.ts.
  if (!(await rateLimit(`feedback:${me.id}`, 3, 24 * 60 * 60 * 1000))) {
    throw new GameError("Thanks — you've already sent feedback today.", 429);
  }

  const parsed = feedbackSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new GameError(parsed.error.issues[0]?.message ?? "Please check the form.", 400);
  }

  await connectDB();
  await Feedback.create({
    userId: me.id,
    rating: parsed.data.rating,
    message: parsed.data.message ?? "",
  });
  return { ok: true };
});
