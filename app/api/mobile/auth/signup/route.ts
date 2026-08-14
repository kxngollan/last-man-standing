import { registerAccount } from "@/lib/signup";
import { json, body, OPTIONS } from "@/lib/mobile/api";
import { clientIp } from "@/lib/rateLimit";

export { OPTIONS };

/**
 * Sign up from the app.
 *
 * Same registerAccount() the website's form calls, so the rate limit, the age
 * gate and the confirmation email behave identically on a phone.
 *
 * No token comes back. The account starts unverified and stays that way until
 * the emailed link is opened — signing them straight in would hand out a
 * session to an address nobody has proved they own, which is the whole point
 * of the confirmation step. The app says "check your inbox" instead.
 *
 * No referral cookie either: a phone has no cookie jar to have picked one up.
 */
export async function POST(request: Request) {
  const payload = await body(request);

  const result = await registerAccount(payload ?? {}, { ip: clientIp(request) });

  if (result.ok) return json({ ok: true, verificationSent: true }, { status: 201 });

  switch (result.reason) {
    case "rate-limited":
      return json(
        { error: "Too many sign-up attempts. Please try again later." },
        { status: 429 }
      );
    case "invalid":
      return json({ error: result.message, fieldErrors: result.fieldErrors }, { status: 400 });
    case "too-young":
    case "needs-parental-consent":
      return json({ error: result.message }, { status: 400 });
    case "taken":
      return json({ error: "An account with that email already exists." }, { status: 409 });
  }
}
