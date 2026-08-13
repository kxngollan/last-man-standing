import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/passwordReset";
import { readJson } from "@/lib/api";
import { clientIp } from "@/lib/rateLimit";

// The flow itself — validation, rate limits, token, email — lives in
// requestPasswordReset(), shared with the mobile endpoint. This route only
// turns the outcome into the wording and status codes the web form expects.
export async function POST(request: Request) {
  const body = await readJson<{ email?: string }>(request);
  const result = await requestPasswordReset(body?.email, clientIp(request));

  if (result.ok) return NextResponse.json({ ok: true });

  switch (result.reason) {
    case "disabled":
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    case "malformed":
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    case "rate-limited":
      return NextResponse.json(
        { error: "Too many reset requests. Please try again in a few minutes." },
        { status: 429 }
      );
    case "no-account":
      return NextResponse.json(
        { error: "No account found for that email address." },
        { status: 404 }
      );
    case "send-failed":
      return NextResponse.json(
        { error: "We couldn’t send the email right now. Please try again shortly." },
        { status: 502 }
      );
  }
}
