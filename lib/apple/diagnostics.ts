import { decodeJwt, decodeProtectedHeader } from "jose";
import { customFetch } from "next-auth";

/**
 * Saying out loud what we actually sent Apple, when Apple says no.
 *
 * `invalid_client` at the token endpoint is the least informative error in this
 * whole flow: it means "the client failed to authenticate" and nothing else,
 * and every part of the request is a candidate. Worse, the same secret can be
 * proved good out-of-band — Apple's /auth/revoke accepts it — while the token
 * exchange still refuses it, which leaves the request itself as the only thing
 * left to look at. There is no way to see that request from outside, so this
 * prints it.
 *
 * Only on failure, and only for the token endpoint. A successful sign-in logs
 * nothing, so this can stay where it is rather than being pulled out again the
 * next time Apple gets mysterious.
 *
 * Deliberately never prints the client secret. Its claims are what matter —
 * which key signed it, for which team, naming which client — and those are the
 * things that can be wrong.
 */

type FetchArgs = Parameters<typeof fetch>;
type FetchLike = (...args: FetchArgs) => Promise<Response>;

const TOKEN_PATH = "/auth/token";

function claimsOf(secret: string): string {
  try {
    const { kid } = decodeProtectedHeader(secret);
    const { iss, sub, aud, iat, exp } = decodeJwt(secret);
    const life = typeof exp === "number" && typeof iat === "number" ? `${exp - iat}s` : "?";
    return `kid=${kid} iss=${iss} sub=${sub} aud=${aud} life=${life}`;
  } catch (err) {
    return `unparseable (${(err as Error).message})`;
  }
}

async function describeRequest(args: FetchArgs): Promise<string> {
  const init = args[1];
  const raw =
    typeof init?.body === "string"
      ? init.body
      : init?.body instanceof URLSearchParams
        ? init.body.toString()
        : args[0] instanceof Request
          ? await args[0].clone().text()
          : "";

  const params = new URLSearchParams(raw);
  const secret = params.get("client_secret");
  const parts = [...params.keys()]
    .filter((k) => k !== "client_secret")
    .map((k) => `${k}=${k === "code" ? "<redacted>" : params.get(k)}`);

  // Basic auth instead of a body parameter would mean Auth.js chose
  // client_secret_basic, which Apple rejects outright — worth seeing.
  const authHeader = new Headers(init?.headers ?? {}).has("authorization");

  return [
    parts.join(" "),
    `client_secret ${secret ? `in body: ${claimsOf(secret)}` : "ABSENT FROM BODY"}`,
    `authorization header: ${authHeader ? "present" : "absent"}`,
  ].join("\n    ");
}

/** Wraps the provider's own fetch, keeping whatever it already did. */
export function withTokenDiagnostics<T extends object>(provider: T): T {
  const holder = provider as Record<symbol, unknown>;
  const inner = (holder[customFetch] as FetchLike | undefined) ?? ((...a: FetchArgs) => fetch(...a));

  holder[customFetch] = async (...args: FetchArgs): Promise<Response> => {
    const response = await inner(...args);
    const url = args[0] instanceof Request ? args[0].url : String(args[0]);
    if (response.ok || !url.includes(TOKEN_PATH)) return response;

    try {
      // Clone before reading: the caller still needs to consume the body.
      const body = await response.clone().text();
      console.error(
        `[apple] token exchange failed — ${response.status} ${body}\n` +
          `  sent to ${url}\n    ${await describeRequest(args)}`
      );
    } catch (err) {
      console.error(`[apple] token exchange failed, and so did logging it: ${(err as Error).message}`);
    }
    return response;
  };

  return provider;
}
