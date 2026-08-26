import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Hide the X-Powered-By header (fingerprinting).
  poweredByHeader: false,
  reactStrictMode: true,
  // Keep heavy native/server-only packages out of the bundler — faster builds
  // and no engine-resolution issues in serverless environments.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
