import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import type { SessionUser } from "@/lib/authz";
import { requireMobileUser } from "./auth";

/**
 * Shared plumbing for /api/mobile/*: CORS, bearer auth, JSON, error shape.
 *
 * Keeps each route to its actual work. Every response carries CORS headers
 * because Expo Web runs in a browser and would otherwise be blocked on every
 * request; native iOS and Android have no origin and ignore them.
 */

// The app is distributed as a binary and Expo Web may be served from anywhere,
// so there's no fixed origin to name. Safe here because these endpoints are
// authorised by a bearer token, never by a cookie — so there is nothing for a
// hostile page to ride on, and "*" cannot be combined with credentials anyway.
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "86400",
};

export function json(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, { ...init, headers: { ...CORS, ...init?.headers } });
}

/** Every mobile route re-exports this as OPTIONS for the preflight. */
export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value);
  return response;
}

type Ctx = { params: Promise<Record<string, string>> };

/** An endpoint anyone may call — fixtures, the league table. */
export function publicRoute<T>(handler: (request: Request, ctx: Ctx) => Promise<T>) {
  return async (request: Request, ctx: Ctx): Promise<NextResponse> => {
    try {
      return json(await handler(request, ctx));
    } catch (err) {
      return withCors(errorResponse(err));
    }
  };
}

/** An endpoint needing a bearer token; the handler gets the user. */
export function authedRoute<T>(
  handler: (user: SessionUser, request: Request, ctx: Ctx) => Promise<T>
) {
  return async (request: Request, ctx: Ctx): Promise<NextResponse> => {
    try {
      const user = await requireMobileUser(request);
      return json(await handler(user, request, ctx));
    } catch (err) {
      return withCors(errorResponse(err));
    }
  };
}

/** Body of a JSON request, or null when it isn't valid JSON. */
export async function body<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
