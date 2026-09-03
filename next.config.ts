import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.STANDALONE === "true" ? { output: "standalone" } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.cloudflarestorage.com",
      },
    ],
  },
};

export default nextConfig;

