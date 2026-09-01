import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

test("PostgreSQL import saves valid rows and reports conflicts without touching customer tenants", { skip: process.env.RESERVATION_IMPORT_DB_TESTS !== "true" }, async () => {
  const { db } = await import("@/lib/db");
  const { importReservationRows } = await import("./import-service");
  const id = `reservation-import-test-${randomUUID()}`;
  let created = false;
  try {
    await db.organization.create({ data: { id, name: "Automated import check" } });
    created = true;
    await db.hotel.create({ data: { id, orgId: id, name: "Import fixture", slug: id } });
    const type = await db.roomType.create({ data: { hotelId: id, name: "Standard", capacity: 2, basePrice: 25_000 } });
    await db.room.create({ data: { hotelId: id, roomTypeId: type.id, number: "101" } });
    const rows = [
      { sourceRow: 2, guestName: "Айбек", roomNumber: "101", checkIn: "2031-09-01", checkOut: "2031-09-03" },
      { sourceRow: 3, guestName: "Иван", roomNumber: "101", checkIn: "2031-09-02", checkOut: "2031-09-04" },
      { sourceRow: 4, guestName: "Мария", roomNumber: "999", checkIn: "2031-09-04", checkOut: "2031-09-05" },
    ];
    const result = await importReservationRows(id, rows);
    assert.equal(result.imported, 1);
    assert.deepEqual(result.errors.map(error => error.sourceRow), [3, 4]);
    assert.match(result.errors[0].message, /уже есть бронь/);
    assert.match(result.errors[1].message, /Номер не найден/);
    assert.equal(await db.reservation.count({ where: { hotelId: id } }), 1);
    assert.equal((await db.reservation.findFirstOrThrow({ where: { hotelId: id } })).notes, "Импорт из Excel, строка 2");
  } finally {
    if (created) {
      await db.auditLog.deleteMany({ where: { hotelId: id } });
      await db.reservation.deleteMany({ where: { hotelId: id } });
      await db.organization.delete({ where: { id } });
    }
    await db.$disconnect();
  }
});
