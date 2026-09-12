import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, googleOAuthConfigured, OAUTH_STATE_COOKIE } from "@/lib/auth/google";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/** Starts the Google authorization code flow. */
export async function GET() {
  try {
    await enforceRateLimit("google-oauth-start", "google", 20, 15 * 60_000);
  } catch {
    return NextResponse.json({ error: "too-many-requests" }, { status: 429 });
  }
  if (!googleOAuthConfigured()) {
    return NextResponse.json({ error: "google-not-configured" }, { status: 503 });
  }

  const state = randomBytes(16).toString("hex");

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
