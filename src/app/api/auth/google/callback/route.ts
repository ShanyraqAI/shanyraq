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
  let user = await db.user.findUnique({ where: { email }, select: { id: true, onboardingCompleted: true } });

  if (!user) {
    const displayName = profile.name?.trim() || email.split("@")[0];
    const newUser = await db.user.create({
      data: {
        email,
        fullName: displayName,
        avatarUrl: profile.picture ?? null,
      },
      select: { id: true, onboardingCompleted: true },
    });

    const org = await db.organization.create({
      data: { name: `${displayName} — Организация` },
    });

    const hotel = await db.hotel.create({
      data: {
        orgId: org.id,
        slug: `hotel-${newUser.id.slice(0, 8)}-${Date.now().toString(36)}`,
        name: `Отель ${displayName.split(" ")[0]}`,
        timezone: "Asia/Almaty",
        currency: "KZT",
        country: "Казахстан",
      },
    });

    await db.membership.create({
      data: {
        organizationId: org.id,
        userId: newUser.id,
        hotelId: hotel.id,
        role: "OWNER",
      },
    });

    user = newUser;
  }

  await createSession(user.id);

  const redirectUrl = user.onboardingCompleted ? "/dashboard" : "/onboarding";
  return NextResponse.redirect(new URL(redirectUrl, url.origin));
}