import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output for the Docker image -- copies only the pruned
  // node_modules subset the build actually needs into .next/standalone,
  // instead of shipping the whole workspace's node_modules.
  output: "standalone",
  // Pins the monorepo root explicitly -- otherwise Next.js's lockfile
  // detection can pick up an unrelated lockfile elsewhere on this
  // machine and misinfer the workspace root.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
