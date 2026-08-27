import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Tenant-aware helpers for multi-tenant data access.
 * All data access must go through these helpers to ensure proper tenant isolation.
 */

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  membershipId: string;
  hotelId: string;
  organizationId: string;
  role: string;
}

export interface CurrentMembership {
  id: string;
  role: string;
  organizationId: string;
  hotelId: string;
  userId: string;
}

export interface CurrentHotel {
  id: string;
  orgId: string | null;
  slug: string;
  name: string;
  propertyType: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      avatarUrl: true,
      onboardingCompleted: true,
      memberships: { take: 1, select: { id: true, role: true, organizationId: true, hotelId: true } },
    },
  });
  if (!user || !user.memberships.length) return null;
  const m = user.memberships[0];
  if (!m.hotelId) return null;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    onboardingCompleted: user.onboardingCompleted,
    membershipId: m.id,
    hotelId: m.hotelId,
    organizationId: m.organizationId,
    role: m.role,
  };
}

export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.membershipId, role: user.role, organizationId: user.organizationId, hotelId: user.hotelId, userId: user.id };
}

export async function getCurrentHotel(): Promise<CurrentHotel | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const hotel = await db.hotel.findUnique({
    where: { id: membership.hotelId },
    select: { id: true, orgId: true, slug: true, name: true, propertyType: true, address: true, city: true, country: true, timezone: true, currency: true },
  });
  return hotel;
}

export async function getCurrentHotelId(): Promise<string> {
  const hotel = await getCurrentHotel();
  if (!hotel) throw new Error("Отель не найден. Завершите онбординг или войдите в аккаунт.");
  return hotel.id;
}

export async function getCurrentOrganization() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  return db.organization.findUnique({ where: { id: membership.organizationId }, select: { id: true, name: true } });
}

export async function assertHotelAccess(hotelId: string): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || membership.hotelId !== hotelId) throw new Error("Доступ запрещен: отель не принадлежит текущему пользователю");
}

export async function assertOrganizationAccess(organizationId: string): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || membership.organizationId !== organizationId) throw new Error("Доступ запрещен: организация не принадлежит текущему пользователю");
}