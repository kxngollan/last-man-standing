import { NextResponse } from "next/server";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User";
import { createResetToken } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import isEmail from "@/lib/isEmail";
import { readJson } from "@/lib/api";

// Always responds { ok: true } regardless of whether the email exists,
// so it can't be used to probe which accounts are registered.
export async function POST(request: Request) {
  const body = await readJson<{ email?: string }>(request);
  const email = (body?.email ?? "").trim().toLowerCase();

  if (email && isEmail(email)) {
    try {
      await connectDB();
      const user = await User.findOne({ email });
      if (user) {
        const token = await createResetToken(String(user._id));
        const base = process.env.APP_URL ?? "http://localhost:3000";
        await sendPasswordResetEmail(email, `${base}/reset?token=${token}`);
      }
    } catch (err) {
      // Log for the developer, but never reveal failure to the caller.
      console.error("[auth] forgot-password error:", (err as Error).message);
    }
  }

  return NextResponse.json({ ok: true });
}
