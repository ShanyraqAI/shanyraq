"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentHotelId } from "@/lib/db";
import { roomStatusSchema, firstZodError } from "@/lib/constants";
import { writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";

export async function setRoomStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = roomStatusSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await getCurrentHotelId();
    const room = await db.room.findFirst({ where: { id: parsed.data.roomId, hotelId } });
    if (!room) return fail("Room not found");

    await db.room.update({
      where: { id: room.id },
      data: { status: parsed.data.status },
    });
    await writeAudit(hotelId, "room.status_changed", "Room", room.id, { status: parsed.data.status });
    revalidatePath("/dashboard/rooms");
    revalidatePath("/dashboard");
    return ok(undefined, `Room ${room.number} → ${parsed.data.status.replace("_", " ").toLowerCase()}`);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
