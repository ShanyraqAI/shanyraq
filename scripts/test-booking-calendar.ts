/** Run after all migrations on a NEW LOCAL disposable PostgreSQL database.
 * No .env loading, no migration/reset, and every fixture rolls back. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const raw = process.env.CALENDAR_TEST_DATABASE_URL;
  if (process.env.CALENDAR_TEST_DISPOSABLE !== "1" || !raw)
    throw new Error(
      "Use an explicitly approved local disposable calendar database.",
    );
  const url = new URL(raw);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !decodeURIComponent(url.pathname).endsWith("_test")
  )
    throw new Error("Only a local database named *_test is allowed.");
  process.env.DATABASE_URL = raw;
  const { db } = await import("@/lib/db");
  const { createReservation, computeStayTotal, OverbookingError } =
    await import("@/lib/reservations/service");
  const { PublicError } = await import("@/server/errors");
  const rollback = new Error("ROLLBACK_CALENDAR_FIXTURES");
  const id = `calendar-test-${randomUUID()}`;
  try {
    await db.$transaction(
      async (tx) => {
        await tx.organization.create({
          data: { id, name: "Disposable calendar fixture" },
        });
        await tx.hotel.create({
          data: {
            id,
            orgId: id,
            slug: id,
            name: "Disposable calendar fixture",
          },
        });
        const property = await tx.rentalProperty.create({
          data: {
            organizationId: id,
            hotelId: id,
            internalName: id,
            publicName: id,
            inventoryMode: "SINGLE_UNIT",
          },
        });
        const type = await tx.roomType.create({
          data: {
            hotelId: id,
            rentalPropertyId: property.id,
            name: "Fixture",
            capacity: 2,
            basePrice: 10000,
          },
        });
        const room = await tx.room.create({
          data: {
            hotelId: id,
            rentalPropertyId: property.id,
            roomTypeId: type.id,
            number: "Fixture",
          },
        });
        const guest = await tx.guest.create({
          data: { hotelId: id, fullName: "Synthetic guest" },
        });
        const plan = await tx.ratePlan.create({
          data: {
            hotelId: id,
            rentalPropertyId: property.id,
            roomTypeId: type.id,
            name: "Fixture",
            basePrice: 10000,
            currency: "KZT",
          },
        });
        await tx.rate.create({
          data: {
            ratePlanId: plan.id,
            date: new Date("2030-12-31T00:00:00Z"),
            price: 15000,
          },
        });
        const input = {
          hotelId: id,
          guestId: guest.id,
          roomId: room.id,
          ratePlanId: plan.id,
          checkIn: "2030-12-31",
          checkOut: "2031-01-02",
          checkInTime: "14:00",
          checkOutTime: "12:00",
          adults: 1,
          children: 0,
          sourceChannel: "direct",
          enqueueChannelSync: false,
        };
        const quote = await computeStayTotal(
          id,
          plan.id,
          type.id,
          new Date("2030-12-31T00:00:00Z"),
          new Date("2031-01-02T00:00:00Z"),
          tx,
        );
        assert.equal(quote.total, 25000);
        const saved = await createReservation(
          {
            ...input,
            expectedRateTotal: quote.total,
            expectedRateCurrency: quote.currency,
          },
          { tx },
        );
        assert.equal(Number(saved.totalAmount), quote.total);
        assert.equal(
          await tx.auditLog.count({
            where: {
              hotelId: id,
              entityId: saved.id,
              action: "reservation.created",
            },
          }),
          1,
        );
        await createReservation(
          { ...input, checkIn: "2031-01-02", checkOut: "2031-01-03" },
          { tx },
        );
        await assert.rejects(
          createReservation(
            {
              ...input,
              checkIn: "2031-01-03",
              checkOut: "2031-01-04",
              checkInTime: "11:00",
            },
            { tx },
          ),
          OverbookingError,
        );
        await assert.rejects(
          createReservation({ ...input, hotelId: "foreign-tenant" }, { tx }),
          PublicError,
        );
        await assert.rejects(
          createReservation(
            {
              ...input,
              checkIn: "2031-01-04",
              checkOut: "2031-01-05",
              expectedRateTotal: 9999,
              expectedRateCurrency: "KZT",
            },
            { tx },
          ),
          PublicError,
        );
        assert.equal(await tx.reservation.count({ where: { hotelId: id } }), 2);
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await db.$disconnect();
  }
  console.log(
    "Calendar DB checks passed; fixtures rolled back. Concurrency and HTTP auth require separate release tests.",
  );
}
void main().catch(() => {
  console.error(
    "Calendar DB check failed. No reset or migration was attempted.",
  );
  process.exitCode = 1;
});
