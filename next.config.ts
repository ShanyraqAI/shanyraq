import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // Hide the X-Powered-By header (fingerprinting).
  poweredByHeader: false,
  reactStrictMode: true,
  // Allow multipart overhead; individual profile images are still capped at 1 MiB.
  // Revisiting a section within 30 s renders from the client router cache instead of
  // waiting for the server; mutations call revalidatePath, which clears it.
  experimental: { serverActions: { bodySizeLimit: "4mb" }, staleTimes: { dynamic: 30 } },
  // Keep heavy native/server-only packages out of the bundler — faster builds
  // and no engine-resolution issues in serverless environments.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/agreements": ["./node_modules/@expo-google-fonts/tinos/**/*.ttf", "./node_modules/@expo-google-fonts/roboto/**/*.ttf"],
    "/api/document-signing": ["./node_modules/@expo-google-fonts/tinos/**/*.ttf", "./node_modules/@expo-google-fonts/roboto/**/*.ttf"],
    "/api/documents/*/pdf": ["./src/assets/fonts/manrope-variable.ttf"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }, { source: "/guest/:path*", headers: [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }];
  },
};

export default nextConfig;
