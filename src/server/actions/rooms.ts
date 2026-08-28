"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { deleteRoomSchema, firstZodError, roomStatusSchema, upsertRoomSchema } from "@/lib/constants";
import { writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";

export async function setRoomStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = roomStatusSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const room = await db.room.findFirst({
      where: { id: parsed.data.roomId, hotelId },
      select: { id: true, number: true },
    });
    if (!room) return fail(t.rooms.errors.roomNotFound);
    const updated = await db.room.updateMany({
      where: { id: room.id, hotelId },
      data: { status: parsed.data.status },
    });
    if (updated.count !== 1) return fail(t.rooms.errors.roomNotFound);
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

export async function upsertRoomAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = upsertRoomSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const data = parsed.data;

    const room = await db.$transaction(async (tx) => {
      if (data.id) {
        const owned = await tx.room.findFirst({ where: { id: data.id, hotelId }, select: { id: true } });
        if (!owned) throw new Error(t.rooms.errors.roomNotFound);
      }

      const duplicate = await tx.room.findFirst({
        where: { hotelId, number: data.number, ...(data.id ? { id: { not: data.id } } : {}) },
        select: { id: true },
      });
      if (duplicate) throw new Error("Номер с таким названием уже существует в этом отеле");

      const existingType = await tx.roomType.findUnique({
        where: { hotelId_name: { hotelId, name: data.roomTypeName } },
        select: { id: true },
      });
      const roomType = existingType
        ? await tx.roomType.update({
            where: { id: existingType.id },
            data: { capacity: data.capacity, basePrice: data.basePrice },
            select: { id: true },
          })
        : await tx.roomType.create({
            data: { hotelId, name: data.roomTypeName, capacity: data.capacity, basePrice: data.basePrice },
            select: { id: true },
          });

      if (data.id) {
        const result = await tx.room.updateMany({
          where: { id: data.id, hotelId },
          data: { number: data.number, floor: data.floor, status: data.status, roomTypeId: roomType.id },
        });
        if (result.count !== 1) throw new Error(t.rooms.errors.roomNotFound);
        return { id: data.id, number: data.number, action: "room.updated" };
      }

      const created = await tx.room.create({
        data: { hotelId, roomTypeId: roomType.id, number: data.number, floor: data.floor, status: data.status },
        select: { id: true },
      });
      return { id: created.id, number: data.number, action: "room.created" };
    });

    await writeAudit(hotelId, room.action, "Room", room.id, { number: room.number });
    revalidateRoomConsumers();
    return ok(undefined, data.id ? "Номер сохранен" : "Номер добавлен");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function deleteRoomAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = deleteRoomSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const room = await db.room.findFirst({
      where: { id: parsed.data.roomId, hotelId },
      select: { id: true, number: true, _count: { select: { reservations: true } } },
    });
    if (!room) return fail(t.rooms.errors.roomNotFound);
    if (room._count.reservations > 0) {
      return fail("Нельзя удалить номер с бронированиями. Измените его статус на «Не используется».");
    }

    const deleted = await db.room.deleteMany({ where: { id: room.id, hotelId } });
    if (deleted.count !== 1) return fail(t.rooms.errors.roomNotFound);
    await writeAudit(hotelId, "room.deleted", "Room", room.id, { number: room.number });
    revalidateRoomConsumers();
    return ok(undefined, `Номер ${room.number} удален`);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

function revalidateRoomConsumers() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/reservations");
}
