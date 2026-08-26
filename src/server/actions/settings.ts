"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { hotelSettingsSchema, firstZodError } from "@/lib/constants";
import { writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";

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
