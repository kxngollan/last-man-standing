import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/passwordReset";
import { readJson, errorResponse } from "@/lib/api";
import { PASSWORD_RESET_ENABLED } from "@/lib/features";

export async function POST(request: Request) {
  try {
    // Password reset is disabled in production for now.
    if (!PASSWORD_RESET_ENABLED) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const body = await readJson<{ token?: string; password?: string }>(request);
    const token = body?.token ?? "";
    const password = body?.password ?? "";
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    const result = await resetPasswordWithToken(token, password);
    if (result !== "ok") {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
