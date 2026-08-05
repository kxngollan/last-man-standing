import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { Feedback } from "@/models/Feedback";
import { feedbackSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { readJson, errorResponse } from "@/lib/api";

// Player feedback: 1–5 rating plus an optional comment (players only).
export async function POST(request: Request) {
  try {
    const user = await requireUser();

    if (!rateLimit(`feedback:${user.id}`, 3, 24 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "You’ve sent plenty of feedback today — thank you! Try again tomorrow." },
        { status: 429 }
      );
    }

    const body = await readJson(request);
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 }
      );
    }

    await connectDB();
    await Feedback.create({
      userId: user.id,
      rating: parsed.data.rating,
      message: parsed.data.message ?? "",
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
