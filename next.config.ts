import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // "*.dev.tsx" pages / "*.dev.ts" routes (e.g. the /test tools) only become
  // routes in development — production builds never compile or serve them.
  pageExtensions: ["tsx", "ts", "jsx", "js", ...(isDev ? ["dev.tsx", "dev.ts"] : [])],

  /**
   * /help and /contact are the two URLs people type when they want /support,
   * and a store listing's support link is not somewhere a 404 can be afforded.
   * Redirects rather than copies of the page: one document to keep true.
   *
   * Permanent (308) — these are not going to move again.
   */
  redirects() {
    return Promise.resolve([
      { source: "/help", destination: "/support", permanent: true },
      { source: "/contact", destination: "/support", permanent: true },
    ]);
  },
};

export default nextConfig;
