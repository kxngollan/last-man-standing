import { attemptLogin } from "@/lib/login";
import { issueMobileToken } from "@/lib/mobile/auth";
import { json, body, OPTIONS } from "@/lib/mobile/api";
import { clientIp } from "@/lib/rateLimit";

export { OPTIONS };

/**
 * Email and password in, a 30-day bearer token out.
 *
 * The Issuecredential check is attemptLogin() — the same function the web's
 * Credentials provider calls — so this door carries the identical per-IP and
 * per-email rate limits and the same constant-time compare. It must never grow
 * its own copy of that logic.
 */
export async function POST(request: Request) {
  const payload = await body<{ email?: unknown; password?: unknown }>(request);
  if (!payload) return json({ error: "Invalid request." }, { status: 400 });

  const result = await attemptLogin(payload.email, payload.password, clientIp(request));

  if (!result.ok) {
    switch (result.reason) {
      case "rate-limited":
        return json(
          { error: "Too many attempts. Please try again in a few minutes." },
          { status: 429 }
        );
      // Told apart from bad credentials on purpose: someone who signed up and
      // never confirmed needs to know to check their inbox, not to keep
      // retyping a password that is actually correct.
      case "unverified":
        return json(
          { error: "Confirm your email address first — check your inbox." },
          { status: 403 }
        );
      case "error":
        return json({ error: "Something went wrong. Please try again." }, { status: 500 });
      default:
        return json({ error: "That email or password isn’t right." }, { status: 401 });
    }
  }

  const { token, expiresAt } = await issueMobileToken(result.user);
  return json({ token, expiresAt, user: result.user });
}
