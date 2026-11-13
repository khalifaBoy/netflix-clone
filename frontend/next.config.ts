import type { NextConfig } from "next";

const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;

if (!publicApiUrl) {
  throw new Error(
    "Backend URL is not configured. Set NEXT_PUBLIC_API_URL (preferred) or API_URL to the backend API base URL.",
  );
}

const nextConfig: NextConfig = {
  // NEXT_PUBLIC_API_URL is the single browser-facing API configuration. Keep
  // API_URL as a build-time alias for existing deployments.
  env: {
    NEXT_PUBLIC_API_URL: publicApiUrl,
  },
};

export default nextConfig;
