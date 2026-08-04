import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // "*.dev.tsx" pages / "*.dev.ts" routes (e.g. the /test tools) only become
  // routes in development — production builds never compile or serve them.
  pageExtensions: ["tsx", "ts", "jsx", "js", ...(isDev ? ["dev.tsx", "dev.ts"] : [])],
};

export default nextConfig;
