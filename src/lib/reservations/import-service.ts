import { db } from "@/lib/db";
import { createReservation } from "@/lib/reservations/service";
import type { ReservationImportResult, ReservationImportRow } from "@/lib/reservations/import-types";
import { PublicError, toErrorMessage } from "@/server/errors";

export async function importReservationRows(hotelId: string, rows: ReservationImportRow[]): Promise<ReservationImportResult> {
  const rooms = await db.room.findMany({ where: { hotelId }, include: { roomType: true } });
  const roomByNumber = new Map(rooms.map(room => [room.number, room]));
  const errors: ReservationImportResult["errors"] = [];
  let imported = 0;
  for (const row of rows) {
    try {
      const room = roomByNumber.get(row.roomNumber);
      if (!room) throw new PublicError("Номер не найден в текущем отеле");
      let guest = await db.guest.findFirst({ where: { hotelId, fullName: { equals: row.guestName } }, select: { id: true } });
      if (!guest) guest = await db.guest.create({ data: { hotelId, fullName: row.guestName, phone: row.guestPhone ?? null }, select: { id: true } });
      let plan = await db.ratePlan.findFirst({ where: { hotelId, roomTypeId: room.roomTypeId }, select: { id: true } });
      if (!plan) {
        const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true } });
        plan = await db.ratePlan.create({
          data: { hotelId, rentalPropertyId: room.rentalPropertyId, roomTypeId: room.roomTypeId, name: `Базовый — ${room.roomType.name}`, basePrice: room.roomType.basePrice, currency: hotel.currency },
          select: { id: true },
        });
      }
      await createReservation({
        hotelId,
        guestId: guest.id,
        roomId: room.id,
        ratePlanId: plan.id,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        adults: 1,
        children: 0,
        sourceChannel: "direct",
        status: "CONFIRMED",
        notes: `Импорт из Excel, строка ${row.sourceRow}`,
      });
      imported++;
    } catch (error) {
      errors.push({ sourceRow: row.sourceRow, message: toErrorMessage(error) });
    }
  }
  return { imported, errors };
}
