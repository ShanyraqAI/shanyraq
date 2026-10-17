"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runMutation } from "@/server/mutation";
import type { MutationContext } from "@/lib/offline/mutation-context";
import { requireSessionHotelId } from "@/server/guards";
import { assertRoomCapacity } from "@/lib/billing/service";
import {
  ACTIVE_RESERVATION_STATUSES,
  deleteRoomSchema,
  firstZodError,
  roomStatusSchema,
  upsertRoomSchema,
} from "@/lib/constants";
import { lockBusinessKeys, writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { PublicError, toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";
import { recomputeExistingAvailability } from "@/lib/availability/service";
import { enqueueHotelChannelSyncs } from "@/lib/channels/sync-outbox";
import { wakeChannelSyncWorker } from "@/server/channel-sync";
import { recordCurrentUserEvent } from "@/lib/analytics/service";
import { z } from "zod";
import { inheritedTypeError } from "@/lib/rooms/type-policy";

export async function saveRoomOrderAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = z.array(z.string().min(1)).min(1).max(1000).safeParse(input);
    if (!parsed.success || new Set(parsed.data).size !== parsed.data.length)
      return fail("Некорректный порядок номеров");
    const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
    await db.$transaction(async (tx) => {
      const rooms = await tx.room.findMany({
        where: { hotelId },
        select: { id: true, roomTypeId: true },
      });
      if (
        rooms.length !== parsed.data.length ||
        rooms.some((room) => !parsed.data.includes(room.id))
      )
        throw new Error("Список номеров изменился. Обновите страницу.");
      const categoryOrder = new Map<string, number>();
      for (const id of parsed.data) {
        const room = rooms.find((item) => item.id === id)!;
        const position = categoryOrder.get(room.roomTypeId) ?? 0;
        await tx.room.update({
          where: { id: room.id },
          data: { sortOrder: position },
        });
        categoryOrder.set(room.roomTypeId, position + 1);
      }
    });
    revalidatePath("/dashboard/calendar");
    return ok(undefined, "Порядок номеров сохранён");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function setRoomStatusAction(
  input: unknown,
  context?: MutationContext,
): Promise<ActionResult> {
  try {
    const parsed = roomStatusSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    return await runMutation(
      context,
      "ROOMS",
      "room.status",
      input,
      async (tx, hotelId, defer) => {
        const room = await (async () => {
          await lockBusinessKeys(tx, [`room:${parsed.data.roomId}`]);
          const owned = await tx.room.findFirst({
            where: { id: parsed.data.roomId, hotelId },
            select: { id: true, number: true, roomTypeId: true, status: true },
          });
          if (!owned) throw new Error(t.rooms.errors.roomNotFound);
          await lockBusinessKeys(tx, [`room-type:${owned.roomTypeId}`]);
          const updated = await tx.room.updateMany({
            where: { id: owned.id, hotelId },
            data: { status: parsed.data.status },
          });
          if (updated.count !== 1) throw new Error(t.rooms.errors.roomNotFound);
          await recomputeExistingAvailability(hotelId, [owned.roomTypeId], tx);
          await enqueueHotelChannelSyncs(tx, hotelId);
          return owned;
        })();
        await writeAudit(
          hotelId,
          "room.status_changed",
          "Room",
          room.id,
          { number: room.number },
          { status: room.status },
          { status: parsed.data.status },
          tx,
        );
        defer(revalidateRoomConsumers);
        return ok(
          undefined,
          t.rooms.statusChanged(
            room.number,
            t.statuses.room[parsed.data.status],
          ),
        );
      },
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function upsertRoomAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = upsertRoomSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
    const data = parsed.data;

    const room = await db.$transaction(
      async (tx) => {
        if (!data.id) await assertRoomCapacity(tx, hotelId);
        if (data.id) {
          const owned = await tx.room.findFirst({
            where: { id: data.id, hotelId },
            select: { id: true, roomTypeId: true },
          });
          if (!owned) throw new Error(t.rooms.errors.roomNotFound);
        }

        const duplicate = await tx.room.findFirst({
          where: {
            hotelId,
            number: data.number,
            ...(data.id ? { id: { not: data.id } } : {}),
          },
          select: { id: true },
        });
        if (duplicate)
          throw new Error(
            "Номер с таким названием уже существует в этом отеле",
          );

        const existingType = await tx.roomType.findUnique({
          where: { hotelId_name: { hotelId, name: data.roomTypeName } },
          select: { id: true, rentalPropertyId: true, capacity: true, basePrice: true },
        });
        if (existingType) {
          const error = inheritedTypeError(
            { capacity: existingType.capacity, basePrice: Number(existingType.basePrice) },
            data,
          );
          if (error) throw new PublicError(error);
        }
        const roomType = existingType
          ? existingType
          : await (async () => {
              const rentalProperty = await tx.rentalProperty.findFirst({
                where: { hotelId },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true },
              });
              if (!rentalProperty)
                throw new Error(
                  "Объект размещения для текущего workspace не найден",
                );
              return tx.roomType.create({
                data: {
                  hotelId,
                  rentalPropertyId: rentalProperty.id,
                  name: data.roomTypeName,
                  capacity: data.capacity,
                  basePrice: data.basePrice,
                },
                select: { id: true, rentalPropertyId: true },
              });
            })();

        if (data.id) {
          await lockBusinessKeys(tx, [`room:${data.id}`]);
          const previous = await tx.room.findFirstOrThrow({
            where: { id: data.id, hotelId },
            select: {
              roomTypeId: true,
              number: true,
              floor: true,
              status: true,
              roomType: { select: { name: true } },
            },
          });
          if (previous.roomTypeId !== roomType.id) {
            // Active stays keep their room type for availability; moving the unit would desync inventory.
            const activeStays = await tx.reservation.count({
              where: {
                hotelId,
                roomId: data.id,
                status: { in: [...ACTIVE_RESERVATION_STATUSES] },
              },
            });
            if (activeStays > 0) {
              throw new PublicError(
                "Нельзя сменить категорию номера с активными бронированиями. Перенесите или завершите брони и повторите.",
              );
            }
          }
          const nextOrder =
            previous.roomTypeId === roomType.id
              ? undefined
              : ((
                  await tx.room.aggregate({
                    where: { hotelId, roomTypeId: roomType.id },
                    _max: { sortOrder: true },
                  })
                )._max.sortOrder ?? -1);
          const result = await tx.room.updateMany({
            where: { id: data.id, hotelId },
            data: {
              number: data.number,
              floor: data.floor,
              status: data.status,
              roomTypeId: roomType.id,
              rentalPropertyId: roomType.rentalPropertyId,
              ...(nextOrder === undefined ? {} : { sortOrder: nextOrder + 1 }),
            },
          });
          if (result.count !== 1) throw new Error(t.rooms.errors.roomNotFound);
          await recomputeExistingAvailability(
            hotelId,
            [previous.roomTypeId, roomType.id],
            tx,
          );
          await enqueueHotelChannelSyncs(tx, hotelId);
          return {
            id: data.id,
            number: data.number,
            action: "room.updated",
            oldValue: {
              number: previous.number,
              floor: previous.floor,
              status: previous.status,
              roomType: previous.roomType.name,
            },
            newValue: {
              number: data.number,
              floor: data.floor,
              status: data.status,
              roomType: data.roomTypeName,
            },
          };
        }

        const maxOrder =
          (
            await tx.room.aggregate({
              where: { hotelId, roomTypeId: roomType.id },
              _max: { sortOrder: true },
            })
          )._max.sortOrder ?? -1;
        const created = await tx.room.create({
          data: {
            hotelId,
            rentalPropertyId: roomType.rentalPropertyId,
            roomTypeId: roomType.id,
            number: data.number,
            floor: data.floor,
            status: data.status,
            sortOrder: maxOrder + 1,
          },
          select: { id: true },
        });
        await recomputeExistingAvailability(hotelId, [roomType.id], tx);
        await enqueueHotelChannelSyncs(tx, hotelId);
        return {
          id: created.id,
          number: data.number,
          action: "room.created",
          oldValue: undefined,
          newValue: {
            number: data.number,
            floor: data.floor,
            status: data.status,
            roomType: data.roomTypeName,
          },
        };
      },
      { timeout: 30_000 },
    );

    await writeAudit(
      hotelId,
      room.action,
      "Room",
      room.id,
      { number: room.number },
      room.oldValue,
      room.newValue,
    );
    await recordCurrentUserEvent(data.id ? "room_updated" : "room_created", {
      type: "Room",
      id: room.id,
    });
    revalidateRoomConsumers();
    return ok({ id: room.id }, data.id ? "Номер сохранен" : "Номер добавлен");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

const onboardingApartmentsSchema = z.object({
  firstNumber: z.string().trim().min(1).max(80),
  count: z.coerce.number().int().min(1).max(100),
  floor: z.coerce.number().int().min(-20).max(300),
  capacity: z.coerce.number().int().min(1).max(30),
  basePrice: z.coerce.number().min(1_000).max(999_000),
});

export async function createOnboardingApartmentsAction(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  try {
    const parsed = onboardingApartmentsSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
    const data = parsed.data;
    const created = await db.$transaction(
      async (tx) => {
        const hotel = await tx.hotel.findUniqueOrThrow({
          where: { id: hotelId },
          select: { name: true },
        });
        const rentalProperty = await tx.rentalProperty.findFirst({
          where: { hotelId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (!rentalProperty)
          throw new Error(
            "Для квартирного профиля не найдено рабочее пространство.",
          );

        const roomTypeName = "Апартаменты";
        const roomType = await tx.roomType.upsert({
          where: { hotelId_name: { hotelId, name: roomTypeName } },
          create: {
            hotelId,
            rentalPropertyId: rentalProperty.id,
            name: roomTypeName,
            capacity: data.capacity,
            basePrice: data.basePrice,
          },
          update: { capacity: data.capacity, basePrice: data.basePrice },
          select: { id: true, rentalPropertyId: true },
        });
        await tx.ratePlan.upsert({
          where: { hotelId_name: { hotelId, name: `${hotel.name} · базовый` } },
          create: {
            hotelId,
            rentalPropertyId: roomType.rentalPropertyId,
            roomTypeId: roomType.id,
            name: `${hotel.name} · базовый`,
            basePrice: data.basePrice,
            currency: "KZT",
          },
          update: {
            roomTypeId: roomType.id,
            rentalPropertyId: roomType.rentalPropertyId,
            basePrice: data.basePrice,
            currency: "KZT",
          },
        });
        const existing = new Set(
          (
            await tx.room.findMany({
              where: { hotelId },
              select: { number: true },
            })
          ).map((room) => room.number.toLocaleLowerCase("ru-RU")),
        );
        const suffix = data.firstNumber.match(/^(.*?)(\d+)$/);
        const prefix = suffix?.[1] ?? `${data.firstNumber} `;
        let nextNumber = suffix ? Number(suffix[2]) : 1;
        const numbers: string[] = [];
        while (numbers.length < data.count) {
          const candidate = suffix
            ? `${prefix}${nextNumber}`
            : data.count === 1
              ? data.firstNumber
              : `${prefix}${nextNumber}`;
          nextNumber += 1;
          const normalized = candidate.toLocaleLowerCase("ru-RU");
          if (existing.has(normalized)) continue;
          existing.add(normalized);
          numbers.push(candidate);
        }
        for (let index = 0; index < data.count; index++)
          await assertRoomCapacity(tx, hotelId);
        await tx.room.createMany({
          data: numbers.map((number, index) => ({
            hotelId,
            rentalPropertyId: roomType.rentalPropertyId,
            roomTypeId: roomType.id,
            number,
            floor: data.floor,
            status: "AVAILABLE",
            sortOrder: index,
          })),
        });
        await recomputeExistingAvailability(hotelId, [roomType.id], tx);
        await enqueueHotelChannelSyncs(tx, hotelId);
        const firstRoom = await tx.room.findFirstOrThrow({
          where: { hotelId, number: numbers[0] },
          select: { id: true },
        });
        return {
          count: numbers.length,
          firstNumber: numbers[0],
          firstRoomId: firstRoom.id,
          hotelName: hotel.name,
        };
      },
      { timeout: 30_000 },
    );
    await writeAudit(
      hotelId,
      "room.created",
      "Room",
      created.firstRoomId,
      { number: created.firstNumber },
      undefined,
      { count: created.count, source: "onboarding" },
    );
    wakeChannelSyncWorker();
    revalidateRoomConsumers();
    return ok(
      { count: created.count },
      `${created.count} квартир добавлено в «${created.hotelName}»`,
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function deleteRoomAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = deleteRoomSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
    const room = await db.$transaction(
      async (tx) => {
        const owned = await tx.room.findFirst({
          where: { id: parsed.data.roomId, hotelId },
          select: {
            id: true,
            number: true,
            floor: true,
            status: true,
            roomTypeId: true,
            roomType: { select: { name: true } },
            _count: { select: { reservations: true } },
          },
        });
        if (!owned) throw new Error(t.rooms.errors.roomNotFound);
        if (owned._count.reservations > 0) {
          throw new Error(
            "Нельзя удалить номер с бронированиями. Измените его статус на «Не используется».",
          );
        }
        const deleted = await tx.room.deleteMany({
          where: { id: owned.id, hotelId },
        });
        if (deleted.count !== 1) throw new Error(t.rooms.errors.roomNotFound);
        await recomputeExistingAvailability(hotelId, [owned.roomTypeId], tx);
        await enqueueHotelChannelSyncs(tx, hotelId);
        return owned;
      },
      { timeout: 30_000 },
    );
    await writeAudit(
      hotelId,
      "room.deleted",
      "Room",
      room.id,
      { number: room.number },
      {
        number: room.number,
        floor: room.floor,
        status: room.status,
        roomType: room.roomType.name,
      },
      {},
    );
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
  wakeChannelSyncWorker();
}
