import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// Versions are MAJOR.MINOR ("0.1"); package.json keeps a ".0" patch for semver.
const appVersion = pkg.version.split(".").slice(0, 2).join(".");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
