import { NextResponse } from "next/server";
import {
  REF_COOKIE,
  REF_COOKIE_MAX_AGE,
  encodeReferralCookie,
  resolveHandle,
} from "@/lib/referral";

/**
 * A shared referral link: /r/<handle> → /signup, carrying who sent them.
 *
 * The cookie is why the referral never rides in the signup form body: the
 * signup schema stays `.strict()` and untouched, and a browser can only present
 * a cookie this route issued. It also survives proxy.ts bouncing a signed-in
 * visitor off /signup, and being read here (not in a server component) keeps
 * every static page static.
 *
 * An unknown handle still lands on /signup — a dud link shouldn't be a dead end.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const response = NextResponse.redirect(new URL("/signup", request.url));

  // A database blip must not break the link; they just arrive uncredited.
  const referrerUserId = await resolveHandle(handle).catch(() => null);
  if (referrerUserId) {
    response.cookies.set(REF_COOKIE, encodeReferralCookie(referrerUserId, handle), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: REF_COOKIE_MAX_AGE,
    });
  }

  return response;
}
