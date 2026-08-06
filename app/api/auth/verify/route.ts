import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/verification";
import { readJson, errorResponse } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// Consumes a verification token. POST on purpose: the /verify page shows a
// confirm button instead of consuming on GET, so email-scanner prefetches
// can't burn the one-shot link before the player clicks it.
export async function POST(request: Request) {
  try {
    if (!(await rateLimit(`verify:${clientIp(request)}`, 10, 15 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }
    const body = await readJson<{ token?: string }>(request);
    const token = typeof body?.token === "string" ? body.token : "";
    const outcome = await consumeVerificationToken(token);
    return NextResponse.json({ outcome });
  } catch (err) {
    return errorResponse(err);
  }
}
