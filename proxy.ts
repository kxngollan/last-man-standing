import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Next 16 renamed `middleware` → `proxy`. This gates the portal and admin areas.
// Uses the DB-free auth config (JWT read only), so it stays lightweight.
const { auth } = NextAuth(authConfig);

const PORTAL_PREFIXES = [
  "/dashboard",
  "/make-selection",
  "/team",
  "/picks",
  "/profile",
  "/settings",
  "/referrals",
];
const AUTH_PAGES = ["/login", "/signup"];
const WELCOME = "/welcome";

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = !!req.auth?.user;
  const isAdmin = !!req.auth?.user?.isAdmin;
  // Signed in with Google/Apple and never asked for a date of birth, so the
  // 16+ gate hasn't been applied to this account yet.
  const needsOnboarding = !!req.auth?.user?.needsOnboarding;

  const isPortal = PORTAL_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");
  const isAuthPage = AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`));
  const isWelcome = path === WELCOME;

  // Already signed in — login/signup have nothing to offer, go home. Unless
  // they're mid-onboarding, in which case that's where they belong.
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL(needsOnboarding ? WELCOME : "/", nextUrl));
  }

  if ((isPortal || isAdminArea || isWelcome) && !isLoggedIn) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Nothing in the portal is reachable before the age check. The page itself
  // checks too — this is only the cheap first pass (proxies see the JWT, not
  // the database, and a claim can be up to five minutes stale).
  if ((isPortal || isAdminArea) && needsOnboarding) {
    const url = new URL(WELCOME, nextUrl);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Nothing left to collect — /welcome is a dead end.
  if (isWelcome && !needsOnboarding) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (isAdminArea && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/make-selection/:path*",
    "/team/:path*",
    "/picks/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/referrals/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
    "/welcome",
  ],
};
