// Central place for SEO / site-identity constants. Reused by the metadata in
// layouts and pages, the sitemap, robots, manifest, OG image, and JSON-LD so
// they can never drift apart.

/**
 * Public base URL, no trailing slash. Reuses APP_URL (the same value used for
 * email links) so there is one source of truth. Set APP_URL to your real
 * https domain in production — canonical, sitemap, and social-share URLs all
 * derive from it. A missing scheme (e.g. "www.example.com") is normalized to
 * https so `new URL(SITE_URL)` in layout metadata can never throw at build.
 */
export const SITE_URL = (() => {
  const raw = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
})();

export const SITE_NAME = "Last Man Standing";
export const SITE_TAGLINE = "Free Premier League Survival Game";

/**
 * Where a player writes to us.
 *
 * Both stores want a contact route that still works for someone locked out of
 * their account — Play asks for one alongside the data deletion URL, Apple wants
 * it on the listing — so it can't be the portal's "Report an issue" form, which
 * needs a session. Same domain as SMTP_FROM's default; set SUPPORT_EMAIL if the
 * mailbox is somewhere else.
 */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@lastmanstanding.app";

export const SITE_DESCRIPTION =
  "Last Man Standing is a free Premier League survival game. Each game week you pick one team to win. Survive, never pick the same team twice, and be the last player standing to win.";

export const SITE_KEYWORDS = [
  "Last Man Standing",
  "Premier League survival game",
  "football survival game",
  "last man standing football",
  "Premier League predictor",
  "free football prediction game",
  "LMS football",
  "football last team standing",
];

/**
 * The publicly indexable routes. Everything else is app/private surface.
 *
 * /delete-account is here because Play's data deletion policy wants the route
 * findable from outside the app — a page nobody can reach without signing in
 * doesn't satisfy it. /support is here for the same reason: it is the Support
 * URL on both listings, and it has to work for someone locked out.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/signup",
  "/login",
  "/policy",
  "/support",
  "/delete-account",
  "/table",
  "/fixtures",
] as const;

/**
 * The site FAQ — single source for both the visible FAQ section on the
 * landing page and the FAQPage JSON-LD, so the structured data always
 * matches the on-page content (a Google requirement for rich results).
 */
export const SITE_FAQS = [
  {
    q: "How do you play Last Man Standing?",
    a: "Each game week, pick one Premier League team you think will win. If they win you go through. If they draw or lose, you are knocked out.",
  },
  {
    q: "Can I pick the same team twice?",
    a: "No. You can only use each team once per game, so save your strongest sides for the tough weeks.",
  },
  {
    q: "What is the wildcard?",
    a: "You get one wildcard per game. Play it with your weekly pick and a draw is enough to go through — only a loss knocks you out. You can take it back any time before the deadline.",
  },
  {
    q: "Is Last Man Standing free to play?",
    a: "Yes. It is free to play, for ages 13 and over — under 16s need a parent or guardian's permission — with no stakes, just bragging rights.",
  },
  {
    q: "Who wins the game?",
    a: "When a single player is left standing, they win the whole game. If everyone falls in the same week, nobody wins and a new game begins.",
  },
  {
    q:"Will there be other leages?",
    a:"Currently we only support premier league, but we will be looking to do other leagues soon."
  }
] as const;
