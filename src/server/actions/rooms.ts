"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { roomStatusSchema, firstZodError } from "@/lib/constants";
import { writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";

export async function setRoomStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = roomStatusSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const room = await db.room.findFirst({ where: { id: parsed.data.roomId, hotelId } });
    if (!room) return fail(t.rooms.errors.roomNotFound);

    await db.room.update({
      where: { id: room.id },
      data: { status: parsed.data.status },
    });
    await writeAudit(hotelId, "room.status_changed", "Room", room.id, { status: parsed.data.status });
    revalidatePath("/dashboard/rooms");
    revalidatePath("/dashboard");
    return ok(
      undefined,
      t.rooms.statusChanged(room.number, t.statuses.room[parsed.data.status]),
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
