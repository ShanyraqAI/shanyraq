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
        rentalPropertyId: roomType.rentalPropertyId,
        roomTypeId: data.roomTypeId,
        name: data.name,
        basePrice: data.basePrice,
        currency: hotel.currency,
        refundable: data.refundable,
        breakfastIncluded: data.breakfastIncluded,
      },
    });
    await writeAudit(hotelId, "ratePlan.created", "RatePlan", plan.id, { name: data.name }, undefined, {
      name: data.name,
      price: data.basePrice,
      refundable: data.refundable,
      breakfastIncluded: data.breakfastIncluded,
    });
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
    const previousRates = dates.length ? await db.rate.findMany({
      where: { ratePlanId: plan.id, date: { in: dates } },
      select: {
        price: true,
        minStay: true,
        minStayType: true,
        maxStay: true,
        stopSell: true,
        closedToArrival: true,
        closedToDeparture: true,
      },
    }) : [];
    const previousPrices = [...new Set(previousRates.map((rate) => Number(rate.price)))];
    if (previousRates.length < dates.length) previousPrices.push(Number(plan.basePrice));
    await db.$transaction(async (tx) => {
      for (const date of dates) {
        await tx.rate.upsert({
          where: { ratePlanId_date: { ratePlanId: plan.id, date } },
          create: {
            ratePlanId: plan.id,
            date,
            price: data.price,
            minStay: data.minStay,
            minStayType: data.minStayType,
            maxStay: data.maxStay,
            stopSell: data.stopSell,
            closedToArrival: data.closedToArrival,
            closedToDeparture: data.closedToDeparture,
          },
          update: {
            price: data.price,
            minStay: data.minStay,
            minStayType: data.minStayType,
            maxStay: data.maxStay,
            stopSell: data.stopSell,
            closedToArrival: data.closedToArrival,
            closedToDeparture: data.closedToDeparture,
          },
        });
      }
      await enqueueHotelChannelSyncs(tx, hotelId);
    }, { timeout: 15_000 });
    const updated = dates.length;
    await writeAudit(hotelId, "rates.bulk_updated", "RatePlan", plan.id, {
      name: plan.name,
      from: data.from,
      to: data.to,
      days: updated,
    }, {
      price: previousPrices.length === 1 ? previousPrices[0] : previousPrices.sort((a, b) => a - b).join("–"),
      restrictions: previousRates.length === 1 ? {
        minStay: previousRates[0].minStay,
        minStayType: previousRates[0].minStayType,
        maxStay: previousRates[0].maxStay,
        stopSell: previousRates[0].stopSell,
        closedToArrival: previousRates[0].closedToArrival,
        closedToDeparture: previousRates[0].closedToDeparture,
      } : "mixed",
    }, {
      price: data.price,
      minStay: data.minStay,
      minStayType: data.minStayType,
      maxStay: data.maxStay,
      stopSell: data.stopSell,
      closedToArrival: data.closedToArrival,
      closedToDeparture: data.closedToDeparture,
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
