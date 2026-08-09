import { NextResponse } from "next/server";
import { GameError } from "@/lib/game/errors";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Turn a raw error into a message that actually helps.
 * Safe for production (names the missing config; never leaks secrets/values).
 */
function friendlyMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/^SMTP:/.test(msg)) {
    return "Couldn’t send the email. Check the SMTP_* settings in .env.local.";
  }
  if (/MONGO_DB_URI|MONGO_DB_NAME/i.test(msg)) {
    return "The database isn’t configured. Set MONGO_DB_URI and MONGO_DB_NAME in .env.local, then restart the dev server.";
  }
  if (/ECONNREFUSED|ENOTFOUND|querySrv|getaddrinfo|ETIMEDOUT|serverSelection|topology/i.test(msg)) {
    return "Couldn’t reach the database. Check MONGO_DB_URI and that your cluster is running and your IP is allowlisted.";
  }
  if (/bad auth|authentication failed|not authorized/i.test(msg)) {
    return "Database authentication failed. Check the username and password in MONGO_DB_URI.";
  }
  if (/FOOTBALL_API/i.test(msg)) {
    return "The football data API key isn’t set. Add FOOTBALL_API to .env.local.";
  }
  if (/AUTH_SECRET|MissingSecret/i.test(msg)) {
    return "Auth isn’t configured. Set AUTH_SECRET in .env.local.";
  }
  return "Something went wrong. Please try again.";
}

/** Map a thrown error to a JSON error response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof GameError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[api] unhandled error:", err);
  const detail = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "Error";
  return NextResponse.json(
    {
      error: friendlyMessage(err),
      // Raw cause, dev only — surfaced to the UI so you can see exactly what broke.
      ...(isDev ? { detail, name } : {}),
    },
    { status: 500 }
  );
}

/**
 * One cookie off a request. Route handlers are already dynamic, so reading
 * cookies here costs nothing — unlike `cookies()` in a server component, which
 * would opt static pages into dynamic rendering.
 */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null; // malformed percent-encoding — treat as absent
    }
  }
  return null;
}

/** Parse a JSON body, returning null on failure. */
export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
