import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { appOrigin, exchangeGoogleCode, googleOAuthConfigured, OAUTH_STATE_COOKIE } from "@/lib/auth/google";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { recordAnalyticsEvent, recordAnalyticsEventSafely } from "@/lib/analytics/service";

/** Finishes the Google flow: validates state, upserts the user, opens a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin();
  const loginUrl = new URL("/login", origin);

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

  const profile = await exchangeGoogleCode(code);
  if (!profile?.email || profile.email_verified !== true) {
    loginUrl.searchParams.set("error", "google");
    return NextResponse.redirect(loginUrl);
  }

  try {
    await enforceRateLimit("google-oauth-callback", profile.sub, 10, 15 * 60_000);
  } catch {
    loginUrl.searchParams.set("error", "google");
    return NextResponse.redirect(loginUrl);
  }

  const email = profile.email.toLowerCase();
  let user: { id: string; onboardingCompleted: boolean } | null = await db.user.findFirst({
    where: { oauthAccounts: { some: { provider: "google", providerAccountId: profile.sub } } },
    select: { id: true, onboardingCompleted: true },
  });

  if (!user) {
    const displayName = profile.name?.trim() || email.split("@")[0];
    user = await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email }, select: { id: true, onboardingCompleted: true, emailVerifiedAt: true } });
      const wasCreated = !existing;
      if (existing && !existing.emailVerifiedAt) throw new Error("Existing email is not verified");
      let accountUser: { id: string; onboardingCompleted: boolean } | null = existing
        ? { id: existing.id, onboardingCompleted: existing.onboardingCompleted }
        : null;
      const invitations = await tx.hotelInvitation.findMany({ where: { email, status: "PENDING", expiresAt: { gt: new Date() } } });
      if (!accountUser) {
        accountUser = await tx.user.create({
          data: {
            email,
            emailVerifiedAt: new Date(),
            fullName: displayName,
        firstName: profile.given_name?.trim() || null,
        lastName: profile.family_name?.trim() ?? null,
            avatarUrl: profile.picture ?? null,
            onboardingCompleted: invitations.length > 0,
          },
          select: { id: true, onboardingCompleted: true },
        });
        if (invitations.length === 0) {
          const org = await tx.organization.create({ data: { name: `${displayName} — Организация` } });
          const hotel = await tx.hotel.create({
            data: { orgId: org.id, slug: `hotel-${crypto.randomUUID()}`, name: `Отель ${displayName.split(" ")[0]}`, timezone: "Asia/Almaty", currency: "KZT", country: "Казахстан" },
          });
          await tx.membership.create({ data: { organizationId: org.id, userId: accountUser.id, hotelId: hotel.id, role: "OWNER", accessLevel: "FULL" } });
        }
      }
      if (!accountUser) throw new Error("Unable to provision Google account");
      await tx.oAuthAccount.create({ data: { userId: accountUser.id, provider: "google", providerAccountId: profile.sub } });
      if (invitations.length > 0) {
        await tx.membership.createMany({ data: invitations.map((item) => ({ organizationId: item.organizationId, hotelId: item.hotelId, userId: accountUser.id, role: "STAFF", accessLevel: item.accessLevel, permissions: item.permissions })), skipDuplicates: true });
        await tx.hotelInvitation.updateMany({ where: { id: { in: invitations.map((item) => item.id) } }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
        for (const invitation of invitations) {
          await tx.auditLog.create({ data: { hotelId: invitation.hotelId, actor: "user", actorUserId: accountUser.id, action: "staff.invitation_accepted", entity: "User", entityId: accountUser.id, metaJson: JSON.stringify({ name: displayName, email }), newValueJson: JSON.stringify({ email, permissions: invitation.permissions }) } });
          const owners = await tx.membership.findMany({ where: { hotelId: invitation.hotelId, role: "OWNER" }, select: { userId: true } });
          await tx.notification.createMany({ data: owners.map((owner) => ({ hotelId: invitation.hotelId, recipientUserId: owner.userId, type: "STAFF", title: `${displayName} принял(а) приглашение`, body: email, href: "/dashboard/settings", dedupeKey: `invitation-accepted:${invitation.id}` })), skipDuplicates: true });
        }
      }
      if (wasCreated) {
        const membership = await tx.membership.findFirst({
          where: { userId: accountUser.id },
          orderBy: { createdAt: "asc" },
          select: { organizationId: true, hotelId: true, role: true },
        });
        await recordAnalyticsEvent({
          eventType: "signup_completed",
          userId: accountUser.id,
          organizationId: membership?.organizationId,
          hotelId: membership?.hotelId,
          entityType: "User",
          entityId: accountUser.id,
          metadata: { method: "google" },
        }, tx);
        if (membership?.role === "OWNER") {
          await recordAnalyticsEvent({
            eventType: "hotel_created",
            userId: accountUser.id,
            organizationId: membership.organizationId,
            hotelId: membership.hotelId,
            entityType: "Hotel",
            entityId: membership.hotelId,
          }, tx);
        }
      }
      return accountUser;
    });
  }

  if (!user) {
    loginUrl.searchParams.set("error", "google");
    return NextResponse.redirect(loginUrl);
  }

  const sessionId = await createSession(user.id);
  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, hotelId: true },
  });
  await recordAnalyticsEventSafely({
    eventType: "login",
    userId: user.id,
    organizationId: membership?.organizationId,
    hotelId: membership?.hotelId,
    sessionId,
    metadata: { method: "google" },
  });

  const redirectUrl = user.onboardingCompleted ? "/dashboard" : "/onboarding";
  return NextResponse.redirect(new URL(redirectUrl, origin));
}
