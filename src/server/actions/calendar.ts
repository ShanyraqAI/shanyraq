"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { getCurrentMembership } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";

const calendarPreferencesSchema = z.object({
  density: z.enum(["COMFORTABLE", "STANDARD", "COMPACT"]),
  rangeDays: z.union([z.literal(3), z.literal(7), z.literal(14), z.literal(30)]),
  roomColumnWidth: z.enum(["COMPACT", "STANDARD", "WIDE"]),
  showGuestName: z.boolean(),
  showGuestCount: z.boolean(),
  showChannel: z.boolean(),
  showAmount: z.boolean(),
  showReservationId: z.boolean(),
  showNotes: z.boolean(),
  currencyDisplay: z.enum(["SYMBOL", "CODE", "HIDDEN"]),
  reservationColors: z.enum(["BRIGHT", "CALM"]).default("BRIGHT"),
  collapsedRoomTypeIds: z.array(z.string().min(1).max(128)).max(100),
});

export async function saveCalendarPreferencesAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = calendarPreferencesSchema.safeParse(input);
    if (!parsed.success) return fail("Не удалось сохранить настройки календаря");
    const hotelId = await requireSessionHotelId({ permission: "CALENDAR" });
    const membership = await getCurrentMembership();
    if (!membership || membership.hotelId !== hotelId) return fail("Сессия пользователя не найдена");

    await db.calendarPreference.upsert({
      where: { userId_hotelId: { userId: membership.userId, hotelId } },
      create: { userId: membership.userId, hotelId, ...parsed.data },
      update: parsed.data,
    });
    revalidatePath("/dashboard/calendar");
    return ok();
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
