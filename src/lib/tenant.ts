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

export interface CurrentMembership {
  id: string;
  role: string;
  organizationId: string;
  hotelId: string;
  userId: string;
  accessLevel: string;
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
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    phone: sessionUser.phone,
    fullName: sessionUser.fullName,
    firstName: sessionUser.firstName,
    lastName: sessionUser.lastName,
    avatarUrl: sessionUser.avatarUrl,
    onboardingCompleted: sessionUser.onboardingCompleted,
    membershipId: sessionUser.membershipId,
    hotelId: sessionUser.hotelId,
    organizationId: sessionUser.organizationId,
    role: sessionUser.role,
    accessLevel: sessionUser.accessLevel,
  };
}

export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const user = await getCurrentUser();
  if (!user || !user.membershipId || !user.organizationId || !user.hotelId || !user.role || !user.accessLevel) return null;
  return { id: user.membershipId, role: user.role, accessLevel: user.accessLevel, organizationId: user.organizationId, hotelId: user.hotelId, userId: user.id };
}

export async function getCurrentHotel(): Promise<CurrentHotel | null> {
  const membership = await getCurrentMembership();
  if (!membership || !membership.hotelId) return null;
  const hotel = await db.hotel.findFirst({
    where: { id: membership.hotelId, orgId: membership.organizationId },
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
