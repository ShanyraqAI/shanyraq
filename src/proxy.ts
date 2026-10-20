import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "./lib/security/content-policy";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(32).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development", request.nextUrl.pathname.startsWith("/guest/"));
  const requestHeaders = new Headers(request.headers);
  // Always replace spoofable incoming values. Next.js reads this CSP when rendering its scripts.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  // Do not cache HTML containing a one-time nonce in a shared cache.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|icons/|assets/).*)"],
};
