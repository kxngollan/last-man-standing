import { NextResponse } from "next/server";
import { GameError } from "@/lib/game/errors";

/** Map a thrown error to a JSON error response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof GameError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[api] unhandled error:", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Parse a JSON body, returning null on failure. */
export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
