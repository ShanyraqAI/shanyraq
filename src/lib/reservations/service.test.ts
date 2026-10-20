import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

test("PostgreSQL: concurrent creates/moves, boundaries, statuses and tenant isolation", { skip: process.env.RESERVATION_DB_TESTS !== "true" }, async (t) => {
  const { db } = await import("@/lib/db");
  const { createReservation, updateReservationDetails, setReservationStatus, OverbookingError } = await import("./service");
  const { toErrorMessage } = await import("@/server/errors");
  const id = `reservation-test-${randomUUID()}`;
  let created = false;
  try {
    await db.organization.create({ data: { id, name: "Automated reservation regression check" } }); created = true;
    const hotel = await db.hotel.create({ data: { id, orgId: id, name: "Test fixture", slug: id } });
    const property = await db.rentalProperty.create({ data: { organizationId: id, hotelId: id, internalName: hotel.name, publicName: hotel.name, inventoryMode: "GROUPED_UNITS" } });
    const type = await db.roomType.create({ data: { hotelId: id, rentalPropertyId: property.id, name: "Test", capacity: 2, basePrice: 100 } });
    const rooms = await Promise.all(["1", "2", "3"].map(number => db.room.create({ data: { hotelId: id, rentalPropertyId: property.id, roomTypeId: type.id, number } })));
    const guest = await db.guest.create({ data: { hotelId: id, fullName: "Test fixture" } });
    const plan = await db.ratePlan.create({ data: { hotelId: id, rentalPropertyId: property.id, roomTypeId: type.id, name: "Test", basePrice: 100 } });
    const input = { hotelId: hotel.id, guestId: guest.id, roomId: rooms[0].id, ratePlanId: plan.id, checkIn: "2030-01-01", checkOut: "2030-01-03", adults: 1, children: 0, sourceChannel: "direct" };
    await t.test("two simultaneous creates save exactly one booking", async () => {
      const results = await Promise.allSettled([createReservation(input), createReservation(input)]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      const rejected = results.find(r => r.status === "rejected");
      assert.ok(rejected?.status === "rejected" && rejected.reason instanceof OverbookingError);
      assert.equal(await db.reservation.count({ where: { hotelId: id } }), 1);
    });
    await t.test("adjacent stay allowed, partial/enclosing stays rejected", async () => {
      await createReservation({ ...input, checkIn: "2030-01-03", checkOut: "2030-01-04" });
      for (const [checkIn, checkOut] of [["2030-01-02", "2030-01-05"], ["2029-12-31", "2030-01-05"]]) {
        await assert.rejects(createReservation({ ...input, checkIn, checkOut }), OverbookingError);
      }
    });
    const second = await createReservation({ ...input, roomId: rooms[1].id });
    await t.test("two moves into one room: one succeeds, rejected move leaves original intact", async () => {
      const first = await db.reservation.findFirstOrThrow({ where: { hotelId: id, roomId: rooms[0].id, checkIn: new Date("2030-01-01") } });
      const results = await Promise.allSettled([first, second].map(r => updateReservationDetails({ ...input, id: r.id, roomId: rooms[2].id })));
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal(await db.reservation.count({ where: { hotelId: id, roomId: rooms[2].id } }), 1);
      const loserIndex = results.findIndex(r => r.status === "rejected");
      const loser = [first, second][loserIndex];
      assert.equal((await db.reservation.findUniqueOrThrow({ where: { id: loser.id } })).roomId, loser.roomId);
    });
    await t.test("database blocks writers that bypass the service and returns a safe conflict", async () => {
      const saved = await db.reservation.findFirstOrThrow({ where: { hotelId: id, roomId: rooms[2].id } });
      const { id: ignored, financialServices: ignoredFinancialServices, sequenceNumber, ...copy } = saved;
      assert.ok(ignored);
      assert.equal(typeof sequenceNumber, "number");
      assert.equal(ignoredFinancialServices, null);
      await assert.rejects(db.reservation.create({ data: copy }), error => {
        assert.equal(toErrorMessage(error), "В этом номере уже есть бронь на выбранные даты.");
        return true;
      });
      const cancelled = await db.reservation.create({ data: { ...copy, status: "CANCELLED" } });
      await assert.rejects(db.reservation.update({ where: { id: cancelled.id }, data: { status: "CONFIRMED" } }));
      await assert.rejects(setReservationStatus(id, cancelled.id, "CONFIRMED"));
    });
    await t.test("invalid dates and wrong hotel cannot create or move bookings", async () => {
      await assert.rejects(createReservation({ ...input, checkIn: "2030-02-30" }));
      await assert.rejects(createReservation({ ...input, hotelId: "another-hotel" }));
      await assert.rejects(updateReservationDetails({ ...input, id: second.id, hotelId: "another-hotel" }));
    });
  } finally {
    if (created) {
      await db.auditLog.deleteMany({ where: { hotelId: id } });
      await db.reservation.deleteMany({ where: { hotelId: id } });
      await db.organization.delete({ where: { id } });
    }
    await db.$disconnect();
  }
});
