import { authedRoute, body, OPTIONS } from "@/lib/mobile/api";
import { issueSchema } from "@/lib/validation";
import { GameError } from "@/lib/game/errors";
import { connectDB } from "@/database/connect";
import { IssueReport } from "@/models/Report/IssueReport";
import { rateLimit } from "@/lib/rateLimit";

export { OPTIONS };

/** Report a problem from the app. */
export const POST = authedRoute(async (me, request) => {
  if (!(await rateLimit(`issue:${me.id}`, 5, 24 * 60 * 60 * 1000))) {
    throw new GameError("You've reported a few already today. Try again tomorrow.", 429);
  }

  const parsed = issueSchema.safeParse(await body(request));
  if (!parsed.success) {
    throw new GameError(parsed.error.issues[0]?.message ?? "Please check the form.", 400);
  }

  await connectDB();
  await IssueReport.create({
    userId: me.id,
    category: parsed.data.category,
    message: parsed.data.message,
    page: parsed.data.page ?? "mobile",
  });
  return { ok: true };
});
