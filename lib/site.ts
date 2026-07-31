// Central place for SEO / site-identity constants. Reused by the metadata in
// layouts and pages, the sitemap, robots, manifest, OG image, and JSON-LD so
// they can never drift apart.

/**
 * Public base URL, no trailing slash. Reuses APP_URL (the same value used for
 * email links) so there is one source of truth. Set APP_URL to your real
 * https domain in production — canonical, sitemap, and social-share URLs all
 * derive from it.
 */
export const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const SITE_NAME = "Last Man Standing";
export const SITE_TAGLINE = "Free Premier League Survival Game";

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

/** The publicly indexable routes. Everything else is app/private surface. */
export const PUBLIC_ROUTES = ["/", "/signup", "/login", "/policy"] as const;
