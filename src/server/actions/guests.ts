"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentHotelId } from "@/lib/db";
import { upsertGuestSchema, firstZodError } from "@/lib/constants";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";

export async function upsertGuestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = upsertGuestSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await getCurrentHotelId();
    const data = parsed.data;

    if (data.id) {
      const existing = await db.guest.findFirst({ where: { id: data.id, hotelId } });
      if (!existing) return fail("Guest not found");
      await db.guest.update({
        where: { id: existing.id },
        data: {
          fullName: data.fullName,
          email: data.email || null,
          phone: data.phone || null,
          country: data.country || null,
          notes: data.notes || null,
        },
      });
      revalidatePath("/dashboard/guests");
      return ok({ id: existing.id }, "Guest updated");
    }

    const created = await db.guest.create({
      data: {
        hotelId,
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        country: data.country || null,
        notes: data.notes || null,
      },
    });
    revalidatePath("/dashboard/guests");
    return ok({ id: created.id }, "Guest created");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
