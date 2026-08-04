import { NextResponse } from "next/server";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User";
import { createResetToken } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import isEmail from "@/lib/isEmail";
import { readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";
import { PASSWORD_RESET_ENABLED } from "@/lib/features";

// Deliberate tradeoff: this endpoint tells the caller when no account exists
// (404) or the email couldn't be sent (502), so players never sit waiting for
// an email that isn't coming. That makes account enumeration possible, which
// we accept for this app — mitigated by the per-IP rate limit below.
export async function POST(request: Request) {
  if (!PASSWORD_RESET_ENABLED) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await readJson<{ email?: string }>(request);
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!email || !isEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again in a few minutes." },
      { status: 429 }
    );
  }

  try {
    await connectDB();
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { error: "No account found for that email address." },
        { status: 404 }
      );
    }
    const token = await createResetToken(String(user._id));
    const base = process.env.APP_URL ?? "http://localhost:3000";
    await sendPasswordResetEmail(email, `${base}/reset?token=${token}`);
  } catch (err) {
    console.error("[auth] forgot-password error:", (err as Error).message);
    return NextResponse.json(
      { error: "We couldn’t send the email right now. Please try again shortly." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
