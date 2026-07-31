import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Crawlers may index the public marketing/auth-entry pages, but not the API,
// the admin area, or the signed-in portal (which needs a login anyway).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/make-selection",
        "/team",
        "/table",
        "/fixtures",
        "/forgot",
        "/reset",
        "/verify",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
