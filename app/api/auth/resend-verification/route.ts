import { NextResponse } from "next/server";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User";
import { rotateVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import isEmail from "@/lib/isEmail";
import { readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";

// Same enumeration tradeoff as the forgot-password endpoint: explicit 404/409
// responses beat a player waiting for an email that isn't coming. Mitigated
// by the per-IP rate limit below.
export async function POST(request: Request) {
  const body = await readJson<{ email?: string }>(request);
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!email || !isEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`resend-verify:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few minutes." },
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
    if (user.emailVerified) {
      return NextResponse.json(
        { error: "This email is already confirmed — you can log in." },
        { status: 409 }
      );
    }
    const token = await rotateVerificationToken(String(user._id));
    await sendVerificationEmail(email, `${SITE_URL}/verify?token=${token}`);
  } catch (err) {
    console.error("[auth] resend-verification error:", (err as Error).message);
    return NextResponse.json(
      { error: "We couldn’t send the email right now. Please try again shortly." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
