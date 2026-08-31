import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { resolveUserName } from "@/lib/auth/names";

/**
 * DB-backed sessions. The browser holds a random opaque token in an httpOnly
 * cookie; the database stores only its SHA-256 hash, so a database leak does
 * not expose live session tokens.
 */

const SESSION_COOKIE = "shanyraq_session";
export const ACTIVE_HOTEL_COOKIE = "shanyraq_active_hotel";
const SESSION_TTL_MS = 30 * 86_400_000; // 30 days

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  membershipId: string | null;
  hotelId: string | null;
  organizationId: string | null;
  role: string | null;
  accessLevel: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Must only be called from server actions or route handlers (writes a cookie). */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  // Opportunistic cleanup of expired rows.
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Deduplicated per request via React cache. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const activeHotelId = store.get(ACTIVE_HOTEL_COOKIE)?.value;
  if (!token) return null;

  try {
    const session = await db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            fullName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            onboardingCompleted: true,
            memberships: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                role: true,
                organizationId: true,
                hotelId: true,
                accessLevel: true,
              },
            },
          },
        },
      },
    });
    if (!session || session.expiresAt < new Date()) return null;

    const membership =
      session.user.memberships.find((item) => item.hotelId === activeHotelId) ??
      session.user.memberships[0] ??
      null;
    return {
      id: session.user.id,
      email: session.user.email,
      phone: session.user.phone,
      fullName: session.user.fullName,
      ...resolveUserName(session.user),
      avatarUrl: session.user.avatarUrl,
      onboardingCompleted: session.user.onboardingCompleted,
      membershipId: membership?.id ?? null,
      hotelId: membership?.hotelId ?? null,
      organizationId: membership?.organizationId ?? null,
      role: membership?.role ?? null,
      accessLevel: membership?.accessLevel ?? null,
    };
  } catch (error) {
    // Table missing on fresh DB before bootstrap — treat as no session
    if (error instanceof Error && /does not exist|no such table/i.test(error.message)) {
      return null;
    }
    throw error;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOnboardingComplete(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboardingCompleted) {
    redirect("/onboarding");
  }
  return user;
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
