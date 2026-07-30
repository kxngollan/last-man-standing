import { NextResponse } from "next/server";
import { GameError } from "@/lib/game/errors";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Turn a raw error into a message that actually helps.
 * Safe for production (names the missing config; never leaks secrets/values).
 */
function friendlyMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/MONGO_DB_URI/i.test(msg)) {
    return "The database isn’t configured — set MONGO_DB_URI in .env.local, then restart the dev server.";
  }
  if (/ECONNREFUSED|ENOTFOUND|querySrv|getaddrinfo|ETIMEDOUT|serverSelection|topology/i.test(msg)) {
    return "Couldn’t reach the database. Check MONGO_DB_URI and that your cluster is running and your IP is allow-listed.";
  }
  if (/bad auth|authentication failed|not authorized/i.test(msg)) {
    return "Database authentication failed. Check the username and password in MONGO_DB_URI.";
  }
  if (/FOOTBALL_API/i.test(msg)) {
    return "The football data API key isn’t set — add FOOTBALL_API to .env.local.";
  }
  if (/AUTH_SECRET|MissingSecret/i.test(msg)) {
    return "Auth isn’t configured — set AUTH_SECRET in .env.local.";
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

/** Parse a JSON body, returning null on failure. */
export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
