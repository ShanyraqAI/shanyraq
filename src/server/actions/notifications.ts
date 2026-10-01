"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { encryptSecret } from "@/lib/security/credentials";
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

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(20).max(256), auth: z.string().min(10).max(128) }),
});

export async function savePushSubscriptionAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = pushSubscriptionSchema.safeParse(input);
    if (!parsed.success) return fail("Не удалось сохранить push-подписку устройства");
    const membership = await requireNotificationMembership();
    const endpointHash = createHash("sha256").update(parsed.data.endpoint).digest("hex");
    await db.pushSubscription.upsert({
      where: { hotelId_userId_endpointHash: { hotelId: membership.hotelId, userId: membership.userId, endpointHash } },
      create: { hotelId: membership.hotelId, userId: membership.userId, endpointHash, encryptedData: encryptSecret(parsed.data) },
      update: { encryptedData: encryptSecret(parsed.data) },
    });
    return ok(undefined, "Уведомления на этом устройстве включены");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  try {
    const parsed = z.string().url().max(2048).startsWith("https://").safeParse(endpoint);
    if (!parsed.success) return fail("Подписка не найдена");
    const membership = await requireNotificationMembership();
    const endpointHash = createHash("sha256").update(parsed.data).digest("hex");
    await db.pushSubscription.deleteMany({ where: { hotelId: membership.hotelId, userId: membership.userId, endpointHash } });
    return ok(undefined, "Push-уведомления выключены на этом устройстве");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
