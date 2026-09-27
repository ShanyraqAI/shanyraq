"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { hotelSettingsSchema, firstZodError } from "@/lib/constants";
import { writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_HOTEL_COOKIE } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/tenant";
import { z } from "zod";
import { assertBillingWriteAccess } from "@/lib/billing/service";
import { sendHotelInvitation } from "@/lib/email";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { PublicError } from "@/server/errors";
import { randomUUID } from "node:crypto";
import { recordAnalyticsEventSafely } from "@/lib/analytics/service";
import { accessLevelForPermissions, HOTEL_PERMISSIONS } from "@/lib/access";
import { createDefaultRentalProperty, syncDefaultRentalProperty } from "@/lib/rental-properties";

const createHotelSchema = z.object({ name: z.string().trim().min(2, "Введите название отеля").max(120) });
const permissionsSchema = z.array(z.enum(HOTEL_PERMISSIONS)).min(1, "Выберите хотя бы один раздел").max(HOTEL_PERMISSIONS.length)
  .transform((values) => HOTEL_PERMISSIONS.filter((permission) => values.includes(permission)));
const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  permissions: permissionsSchema,
});

async function requireHotelOwner() {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "OWNER") throw new PublicError("Только владелец может управлять отелями и доступом");
  return membership;
}

export async function saveHotelSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = hotelSettingsSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const currentHotelId = await requireSessionHotelId();
    const data = parsed.data;

    const previous = await db.hotel.findUniqueOrThrow({
      where: { id: currentHotelId },
      select: { name: true, address: true, city: true, country: true, timezone: true, currency: true },
    });
    const next = {
      name: data.name,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      timezone: data.timezone,
      currency: data.currency,
    };
    await db.$transaction(async (tx) => {
      const updated = await tx.hotel.update({
        where: { id: currentHotelId },
        data: next,
      });
      await syncDefaultRentalProperty(tx, updated);
    });
    await writeAudit(currentHotelId, "hotel.settings_updated", "Hotel", currentHotelId, undefined, previous, next);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return ok(undefined, t.settings.toastSaved);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function createHotelAction(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const parsed = createHotelSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const owner = await requireHotelOwner();
    await assertBillingWriteAccess(owner.organizationId);
    const slug = `hotel-${randomUUID()}`;
    const hotel = await db.$transaction(async (tx) => {
      const created = await tx.hotel.create({
        data: { orgId: owner.organizationId, slug, name: parsed.data.name, timezone: "Asia/Almaty", currency: "KZT", country: "Казахстан" },
      });
      await createDefaultRentalProperty(tx, created);
      await tx.membership.create({
        data: { organizationId: owner.organizationId, userId: owner.userId, hotelId: created.id, role: "OWNER", accessLevel: "FULL" },
      });
      return { id: created.id, name: created.name };
    });
    const store = await cookies();
    store.set(ACTIVE_HOTEL_COOKIE, hotel.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31_536_000 });
    await recordAnalyticsEventSafely({
      eventType: "hotel_created",
      userId: owner.userId,
      organizationId: owner.organizationId,
      hotelId: hotel.id,
      entityType: "Hotel",
      entityId: hotel.id,
    });
    revalidatePath("/dashboard", "layout");
    return ok(hotel, "Отель создан");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function switchHotelAction(hotelId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const membership = await db.membership.findFirst({ where: { userId: user.id, hotelId }, select: { id: true } });
    if (!membership) return fail("У вас нет доступа к этому отелю");
    const store = await cookies();
    store.set(ACTIVE_HOTEL_COOKIE, hotelId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31_536_000 });
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Отель переключён");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function addHotelMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = memberSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const owner = await requireHotelOwner();
    await enforceRateLimit("hotel-invitation", `${owner.hotelId}:${parsed.data.email}`, 5, 60 * 60_000);
    const accessLevel = accessLevelForPermissions(parsed.data.permissions);
    const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, emailVerifiedAt: true } });
    if (user?.id === owner.userId) return fail("Владелец уже имеет полный доступ");
    if (user?.emailVerifiedAt) {
      await db.membership.upsert({
        where: { userId_hotelId: { userId: user.id, hotelId: owner.hotelId } },
        update: { accessLevel, permissions: parsed.data.permissions, role: "STAFF", organizationId: owner.organizationId },
        create: { organizationId: owner.organizationId, userId: user.id, hotelId: owner.hotelId, role: "STAFF", accessLevel, permissions: parsed.data.permissions },
      });
      await db.hotelInvitation.updateMany({
        where: { hotelId: owner.hotelId, email: parsed.data.email, status: "PENDING" },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    } else {
      const expiresAt = new Date(Date.now() + 7 * 86_400_000);
      const invitation = await db.hotelInvitation.upsert({
        where: { hotelId_email: { hotelId: owner.hotelId, email: parsed.data.email } },
        create: {
          organizationId: owner.organizationId,
          hotelId: owner.hotelId,
          invitedById: owner.userId,
          email: parsed.data.email,
          accessLevel,
          permissions: parsed.data.permissions,
          expiresAt,
        },
        update: { accessLevel, permissions: parsed.data.permissions, status: "PENDING", acceptedAt: null, expiresAt, invitedById: owner.userId },
      });
      const [hotel, inviter] = await Promise.all([
        db.hotel.findUniqueOrThrow({ where: { id: owner.hotelId }, select: { name: true } }),
        db.user.findUniqueOrThrow({ where: { id: owner.userId }, select: { fullName: true } }),
      ]);
      await sendHotelInvitation(parsed.data.email, hotel.name, inviter.fullName, `${invitation.id}-${expiresAt.getTime()}`);
    }
    await writeAudit(owner.hotelId, "staff.access_saved", "User", user?.id, { email: parsed.data.email }, undefined, {
      email: parsed.data.email,
      permissions: parsed.data.permissions,
    });
    revalidatePath("/dashboard/settings");
    return ok(undefined, user?.emailVerifiedAt ? "Доступ пользователя сохранён" : "Приглашение отправлено на email");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function updateHotelMemberAccessAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = z.object({ membershipId: z.string().min(1), permissions: permissionsSchema }).safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const owner = await requireHotelOwner();
    const previous = await db.membership.findFirst({
      where: { id: parsed.data.membershipId, hotelId: owner.hotelId, role: { not: "OWNER" } },
      select: { permissions: true, user: { select: { fullName: true, email: true } } },
    });
    if (!previous) return fail("Пользователь не найден или его права нельзя изменить");
    const updated = await db.membership.updateMany({
      where: { id: parsed.data.membershipId, hotelId: owner.hotelId, role: { not: "OWNER" } },
      data: { accessLevel: accessLevelForPermissions(parsed.data.permissions), permissions: parsed.data.permissions },
    });
    if (!updated.count) return fail("Пользователь не найден или его права нельзя изменить");
    await writeAudit(owner.hotelId, "staff.permissions_updated", "Membership", parsed.data.membershipId, { name: previous.user.fullName, email: previous.user.email }, { permissions: previous.permissions }, { permissions: parsed.data.permissions });
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Права обновлены");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function removeHotelMemberAction(membershipId: string): Promise<ActionResult> {
  try {
    const owner = await requireHotelOwner();
    const member = await db.membership.findFirst({
      where: { id: membershipId, hotelId: owner.hotelId, role: { not: "OWNER" } },
      select: { id: true, permissions: true, user: { select: { fullName: true, email: true } } },
    });
    if (!member) return fail("Пользователь не найден или его нельзя удалить");
    const removed = await db.membership.deleteMany({ where: { id: membershipId, hotelId: owner.hotelId, role: { not: "OWNER" } } });
    if (!removed.count) return fail("Пользователь не найден или его нельзя удалить");
    await writeAudit(owner.hotelId, "staff.access_removed", "Membership", member.id, { name: member.user.fullName, email: member.user.email }, { permissions: member.permissions }, {});
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Доступ удалён");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function cancelHotelInvitationAction(invitationId: string): Promise<ActionResult> {
  try {
    const owner = await requireHotelOwner();
    const removed = await db.hotelInvitation.deleteMany({
      where: { id: invitationId, hotelId: owner.hotelId, status: "PENDING" },
    });
    if (!removed.count) return fail("Приглашение не найдено");
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Приглашение отменено");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
