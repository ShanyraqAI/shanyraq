"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { bulkRateUpdateSchema, firstZodError } from "@/lib/constants";
import { addDays, isWeekend, parseISODate } from "@/lib/dates";
import { writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";
import { z } from "zod";
import { enqueueHotelChannelSyncs } from "@/lib/channels/sync-outbox";
import { wakeChannelSyncWorker } from "@/server/channel-sync";
import { recordCurrentUserEvent } from "@/lib/analytics/service";
import { MAX_NIGHTLY_PRICE, MIN_NIGHTLY_PRICE } from "@/lib/pricing";

const createRatePlanSchema = z.object({
  roomTypeId: z.string().min(1),
  name: z.string().trim().min(1, "Укажите название тарифа").max(100),
  basePrice: z.coerce.number()
    .min(MIN_NIGHTLY_PRICE, "Цена за ночь должна быть не меньше 1 000 ₸")
    .max(MAX_NIGHTLY_PRICE, "Цена за ночь должна быть не больше 999 000 ₸"),
  refundable: z.boolean().default(true),
  breakfastIncluded: z.boolean().default(false),
});

export async function createRatePlanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createRatePlanSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId({ permission: "RATES" });
    const data = parsed.data;
    const roomType = await db.roomType.findFirst({ where: { id: data.roomTypeId, hotelId } });
    if (!roomType) return fail("Категория номера не найдена");
    const existing = await db.ratePlan.findFirst({ where: { hotelId, name: data.name } });
    if (existing) return fail("Тариф с таким названием уже существует");
    const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true } });
    const plan = await db.ratePlan.create({
      data: {
        hotelId,
        roomTypeId: data.roomTypeId,
        name: data.name,
        basePrice: data.basePrice,
        currency: hotel.currency,
        refundable: data.refundable,
        breakfastIncluded: data.breakfastIncluded,
      },
    });
    await writeAudit(hotelId, "ratePlan.created", "RatePlan", plan.id, { name: data.name });
    revalidatePath("/dashboard/rates");
    revalidatePath("/dashboard/reservations");
    return ok({ id: plan.id }, "Тариф создан");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

/**
 * Bulk price update over a date range. This is the internal source of truth
 * that channel rate pushes later read from.
 */
export async function bulkUpdateRatesAction(input: unknown): Promise<ActionResult<{ updated: number }>> {
  try {
    const parsed = bulkRateUpdateSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId({ permission: "RATES" });
    const data = parsed.data;

    const plan = await db.ratePlan.findFirst({ where: { id: data.ratePlanId, hotelId } });
    if (!plan) return fail(t.rates.errors.ratePlanNotFound);

    const from = parseISODate(data.from);
    const to = parseISODate(data.to); // inclusive
    const dates: Date[] = [];
    for (let d = from; d.getTime() <= to.getTime(); d = addDays(d, 1)) {
      if (data.weekendsOnly && !isWeekend(d)) continue;
      dates.push(d);
    }
    await db.$transaction(async (tx) => {
      for (const date of dates) {
        await tx.rate.upsert({
          where: { ratePlanId_date: { ratePlanId: plan.id, date } },
          create: { ratePlanId: plan.id, date, price: data.price },
          update: { price: data.price },
        });
      }
      await enqueueHotelChannelSyncs(tx, hotelId);
    }, { timeout: 15_000 });
    const updated = dates.length;
    await writeAudit(hotelId, "rates.bulk_updated", "RatePlan", plan.id, {
      from: data.from,
      to: data.to,
      price: data.price,
      days: updated,
    });
    await recordCurrentUserEvent("rate_updated", { type: "RatePlan", id: plan.id });
    revalidatePath("/dashboard/rates");
    revalidatePath("/dashboard/channels");
    wakeChannelSyncWorker();
    return ok({ updated }, t.rates.toast(updated));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
