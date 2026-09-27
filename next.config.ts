import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Commit hash + build time are injected by the deploy environment
  // (Netlify: COMMIT_REF; CI: GITHUB_SHA) and surfaced by /api/health.
  env: {
    COMMIT_HASH:
      process.env.COMMIT_REF ?? process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
