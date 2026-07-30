import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Next 16 renamed `middleware` → `proxy`. This gates the portal and admin areas.
// Uses the DB-free auth config (JWT read only), so it stays lightweight.
const { auth } = NextAuth(authConfig);

const PORTAL_PREFIXES = ["/dashboard", "/make-selection", "/team"];

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = !!req.auth?.user;
  const isAdmin = !!req.auth?.user?.isAdmin;

  const isPortal = PORTAL_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");

  if ((isPortal || isAdminArea) && !isLoggedIn) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
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
    "/admin/:path*",
  ],
};
