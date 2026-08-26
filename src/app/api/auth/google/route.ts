import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, googleOAuthConfigured, OAUTH_STATE_COOKIE } from "@/lib/auth/google";

/** Starts the Google authorization code flow. */
export async function GET(request: Request) {
  if (!googleOAuthConfigured()) {
    return NextResponse.json({ error: "google-not-configured" }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const state = randomBytes(16).toString("hex");

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(origin, state));
}
