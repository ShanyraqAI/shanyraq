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

const createHotelSchema = z.object({ name: z.string().trim().min(2, "Введите название отеля").max(120) });
const accessLevelSchema = z.enum(["OVERVIEW", "CALENDAR", "FULL"]);
const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  accessLevel: accessLevelSchema,
});

async function requireHotelOwner() {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "OWNER") throw new Error("Только владелец может управлять отелями и доступом");
  return membership;
}

export async function saveHotelSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = hotelSettingsSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const currentHotelId = await requireSessionHotelId();
    const data = parsed.data;

    await db.hotel.update({
      where: { id: currentHotelId },
      data: {
        name: data.name,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        timezone: data.timezone,
        currency: data.currency,
      },
    });
    await writeAudit(currentHotelId, "hotel.settings_updated", "Hotel", currentHotelId);
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
    const slug = `hotel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const hotel = await db.$transaction(async (tx) => {
      const created = await tx.hotel.create({
        data: { orgId: owner.organizationId, slug, name: parsed.data.name, timezone: "Asia/Almaty", currency: "KZT", country: "Казахстан" },
        select: { id: true, name: true },
      });
      await tx.membership.create({
        data: { organizationId: owner.organizationId, userId: owner.userId, hotelId: created.id, role: "OWNER", accessLevel: "FULL" },
      });
      return created;
    });
    const store = await cookies();
    store.set(ACTIVE_HOTEL_COOKIE, hotel.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31_536_000 });
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
    const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
    if (!user) return fail("Пользователь с таким email ещё не зарегистрирован в Shanyraq");
    if (user.id === owner.userId) return fail("Владелец уже имеет полный доступ");
    await db.membership.upsert({
      where: { userId_hotelId: { userId: user.id, hotelId: owner.hotelId } },
      update: { accessLevel: parsed.data.accessLevel, role: "STAFF" },
      create: { organizationId: owner.organizationId, userId: user.id, hotelId: owner.hotelId, role: "STAFF", accessLevel: parsed.data.accessLevel },
    });
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Доступ пользователя сохранён");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function updateHotelMemberAccessAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = z.object({ membershipId: z.string().min(1), accessLevel: accessLevelSchema }).safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const owner = await requireHotelOwner();
    const updated = await db.membership.updateMany({
      where: { id: parsed.data.membershipId, hotelId: owner.hotelId, role: { not: "OWNER" } },
      data: { accessLevel: parsed.data.accessLevel },
    });
    if (!updated.count) return fail("Пользователь не найден или его права нельзя изменить");
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Права обновлены");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function removeHotelMemberAction(membershipId: string): Promise<ActionResult> {
  try {
    const owner = await requireHotelOwner();
    const removed = await db.membership.deleteMany({ where: { id: membershipId, hotelId: owner.hotelId, role: { not: "OWNER" } } });
    if (!removed.count) return fail("Пользователь не найден или его нельзя удалить");
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Доступ удалён");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
