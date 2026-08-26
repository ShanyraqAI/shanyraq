import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { exchangeGoogleCode, googleOAuthConfigured, OAUTH_STATE_COOKIE } from "@/lib/auth/google";

/** Finishes the Google flow: validates state, upserts the user, opens a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const loginUrl = new URL("/login", url.origin);

  if (!googleOAuthConfigured()) {
    loginUrl.searchParams.set("error", "google");
    return NextResponse.redirect(loginUrl);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  if (!code || !state || !expectedState || state !== expectedState) {
    loginUrl.searchParams.set("error", "google");
    return NextResponse.redirect(loginUrl);
  }

  const profile = await exchangeGoogleCode(code, url.origin);
  if (!profile?.email || profile.email_verified === false) {
    loginUrl.searchParams.set("error", "google");
    return NextResponse.redirect(loginUrl);
  }

  const email = profile.email.toLowerCase();
  let user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        fullName: profile.name?.trim() || email.split("@")[0],
        avatarUrl: profile.picture ?? null,
      },
      select: { id: true },
    });
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
