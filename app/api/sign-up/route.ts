import { NextResponse } from "next/server";
import { registerAccount } from "@/lib/signup";
import { readJson, readCookie, errorResponse } from "@/lib/api";
import { clientIp } from "@/lib/rateLimit";
import { REF_COOKIE } from "@/lib/referral";

/**
 * The web sign-up form's endpoint.
 *
 * The work happens in registerAccount() — shared with the app's sign-up
 * endpoint, so both doors carry the same rate limits, the same 16+ gate, and
 * the same "roll the account back if the email won't send" rule. This handler
 * only turns the outcome into the shape the form expects.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    // A body that isn't JSON still costs rate-limit budget — registerAccount
    // meters before it reads, so pass it through rather than short-circuiting.
    const result = await registerAccount(body ?? {}, {
      ip: clientIp(request),
      referralCookie: readCookie(request, REF_COOKIE),
    });

    if (result.ok) return NextResponse.json({ ok: true }, { status: 201 });

    switch (result.reason) {
      case "rate-limited":
        return NextResponse.json(
          { error: "Too many sign-up attempts. Please try again later." },
          { status: 429 }
        );
      case "invalid":
        return NextResponse.json(
          { error: result.message, fieldErrors: result.fieldErrors },
          { status: 400 }
        );
      case "too-young":
        return NextResponse.json({ error: result.message }, { status: 400 });
      case "taken":
        return NextResponse.json(
          { error: "An account with that email already exists." },
          { status: 409 }
        );
    }
  } catch (err) {
    return errorResponse(err);
  }
}
