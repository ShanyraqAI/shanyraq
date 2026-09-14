"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/server/types";
import { AuthenticationError, toErrorMessage } from "@/server/errors";

async function requireNotificationMembership() {
  const membership = await getCurrentMembership();
  if (!membership) throw new AuthenticationError();
  return membership;
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  try {
    const parsed = z.string().min(1).safeParse(notificationId);
    if (!parsed.success) return fail("Уведомление не найдено");
    const membership = await requireNotificationMembership();
    await db.notification.updateMany({
      where: { id: parsed.data, hotelId: membership.hotelId, recipientUserId: membership.userId },
      data: { readAt: new Date() },
    });
    revalidatePath("/dashboard", "layout");
    return ok();
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const membership = await requireNotificationMembership();
    await db.notification.updateMany({
      where: { hotelId: membership.hotelId, recipientUserId: membership.userId, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/dashboard", "layout");
    return ok();
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function saveNotificationPreferencesAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = z.object({
      newReservationEmail: z.boolean(),
      dailyDigestEmail: z.boolean(),
      digestHour: z.number().int().min(6).max(14),
    }).safeParse(input);
    if (!parsed.success) return fail("Проверьте настройки уведомлений");
    const membership = await requireNotificationMembership();
    await db.membership.update({
      where: { id: membership.id },
      data: parsed.data,
    });
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Настройки уведомлений сохранены");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
