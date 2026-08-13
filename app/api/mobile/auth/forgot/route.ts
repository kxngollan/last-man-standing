import { requestPasswordReset } from "@/lib/passwordReset";
import { json, body, OPTIONS } from "@/lib/mobile/api";
import { clientIp } from "@/lib/rateLimit";

export { OPTIONS };

/**
 * "Send me a reset link", from the app.
 *
 * Same requestPasswordReset() the website's /forgot form calls, so the per-IP
 * and per-address limits are the identical counters — a phone and a browser
 * can't be used to double them up.
 *
 * The link in the email opens the website's /reset page, not the app: the token
 * is single-use and there's no native screen to spend it on. The app's job ends
 * at "check your inbox".
 */
export async function POST(request: Request) {
  const payload = await body<{ email?: unknown }>(request);
  const result = await requestPasswordReset(payload?.email, clientIp(request));

  if (result.ok) return json({ ok: true });

  switch (result.reason) {
    case "disabled":
      return json({ error: "Not found." }, { status: 404 });
    case "malformed":
      return json({ error: "Enter a valid email address." }, { status: 400 });
    case "rate-limited":
      return json(
        { error: "Too many reset requests. Please try again in a few minutes." },
        { status: 429 }
      );
    case "no-account":
      return json({ error: "No account found for that email address." }, { status: 404 });
    case "send-failed":
      return json(
        { error: "We couldn’t send the email right now. Please try again shortly." },
        { status: 502 }
      );
  }
}
