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

/**
 * Bulk price update over a date range. This is the internal source of truth
 * that channel rate pushes later read from.
 */
export async function bulkUpdateRatesAction(input: unknown): Promise<ActionResult<{ updated: number }>> {
  try {
    const parsed = bulkRateUpdateSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const data = parsed.data;

    const plan = await db.ratePlan.findFirst({ where: { id: data.ratePlanId, hotelId } });
    if (!plan) return fail(t.rates.errors.ratePlanNotFound);

    const from = parseISODate(data.from);
    const to = parseISODate(data.to); // inclusive
    let updated = 0;
    for (let d = from; d.getTime() <= to.getTime(); d = addDays(d, 1)) {
      if (data.weekendsOnly && !isWeekend(d)) continue;
      await db.rate.upsert({
        where: { ratePlanId_date: { ratePlanId: plan.id, date: d } },
        create: { ratePlanId: plan.id, date: d, price: data.price },
        update: { price: data.price },
      });
      updated++;
    }
    await writeAudit(hotelId, "rates.bulk_updated", "RatePlan", plan.id, {
      from: data.from,
      to: data.to,
      price: data.price,
      days: updated,
    });
    revalidatePath("/dashboard/rates");
    revalidatePath("/dashboard/channels");
    return ok({ updated }, t.rates.toast(updated));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
