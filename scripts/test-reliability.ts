/** Runs only against an explicitly disposable migrated test DB; never loads .env or resets data. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const configured = process.env.RELIABILITY_TEST_DATABASE_URL;
if (!configured || process.env.RELIABILITY_TEST_DISPOSABLE !== "1")
  throw new Error("Explicit disposable test database required.");
const url = new URL(configured);
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !decodeURIComponent(url.pathname).endsWith("_test")
)
  throw new Error("Test DB name must end in _test.");
process.env.DATABASE_URL = configured;
async function main() {
  const { db } = await import("@/lib/db");
  const { createReservation, updateReservationDetails, setReservationStatus } =
    await import("@/lib/reservations/service");
  const { executeOperation } = await import("@/lib/reservations/operation");
  const { resolveGuest } = await import("@/lib/guests/resolve");
  const { processChannexRevision } =
    await import("@/lib/channels/channex/booking-sync");
  const { loadGuestPage } = await import("@/lib/guests/service");
  const prefix = `reliability-${randomUUID()}`;
  const identity = { userId: prefix, hotelId: prefix };
  let created = false;
  try {
    await db.organization.create({
      data: { id: prefix, name: "Synthetic reliability fixture" },
    });
    created = true;
    await db.hotel.create({
      data: { id: prefix, orgId: prefix, name: "Fixture", slug: prefix },
    });
    await db.user.create({
      data: { id: prefix, fullName: "Synthetic tester" },
    });
    const property = await db.rentalProperty.create({
      data: {
        hotelId: prefix,
        organizationId: prefix,
        internalName: "Fixture",
        publicName: "Fixture",
        inventoryMode: "GROUPED_UNITS",
      },
    });
    const type = await db.roomType.create({
      data: {
        hotelId: prefix,
        rentalPropertyId: property.id,
        name: "Fixture",
        capacity: 2,
        basePrice: 1000,
      },
    });
    const rooms = await Promise.all(
      ["1", "2", "3"].map((number) =>
        db.room.create({
          data: {
            hotelId: prefix,
            rentalPropertyId: property.id,
            roomTypeId: type.id,
            number,
          },
        }),
      ),
    );
    const [guestA, guestB] = await db.$transaction(async (tx) => {
      const a = await resolveGuest(tx, prefix, {
        guestName: "Одинаковое Имя",
        guestEmail: "shared@example.invalid",
      });
      const b = await resolveGuest(tx, prefix, {
        guestName: "Одинаковое Имя",
        guestEmail: "shared@example.invalid",
      });
      assert.notEqual(a.id, b.id);
      assert.equal(
        (await resolveGuest(tx, prefix, { guestId: a.id })).id,
        a.id,
      );
      return [a, b];
    });
    assert.ok(guestB.id);
    console.log(
      "PASS: names and shared contact do not auto-merge guests; explicit tenant ID reuses profile.",
    );
    await assert.rejects(
      db.$transaction((tx) =>
        resolveGuest(tx, prefix, {
          guestId: "another-tenant-guest",
          guestName: "Name",
        }),
      ),
    );
    const stay = {
      hotelId: prefix,
      guestId: guestA.id,
      roomId: rooms[0].id,
      checkIn: "2030-01-01",
      checkOut: "2030-01-03",
      adults: 1,
      children: 0,
      pricingMode: "MANUAL" as const,
      manualTotalAmount: 1000,
      sourceChannel: "direct",
      enqueueChannelSync: false,
    };
    const context = { key: randomUUID(), scope: `${prefix}:${prefix}` };
    const write = (tx: Parameters<typeof resolveGuest>[0]) =>
      createReservation(stay, { tx }).then((booking) => ({
        ok: true,
        data: { id: booking.id },
      }));
    const first = await executeOperation(
      db,
      identity,
      context,
      "reservation.create",
      stay,
      write,
    );
    const retry = await executeOperation(
      db,
      identity,
      context,
      "reservation.create",
      stay,
      write,
    );
    assert.deepEqual(first, retry);
    assert.equal(await db.reservation.count({ where: { hotelId: prefix } }), 1);
    assert.equal(
      await db.auditLog.count({
        where: { hotelId: prefix, action: "reservation.created" },
      }),
      1,
    );
    await assert.rejects(
      executeOperation(
        db,
        identity,
        context,
        "reservation.create",
        { changed: true },
        write,
      ),
    );
    console.log(
      "PASS: lost-response replay returns original booking and audit; mismatched request rejected.",
    );
    // Inject an audit failure through the caller's TX facade; actual reservation writes still use real DB.
    const failedStay = { ...stay, roomId: rooms[1].id };
    const failContext = { key: randomUUID(), scope: context.scope };
    await assert.rejects(
      executeOperation(
        db,
        identity,
        failContext,
        "reservation.create",
        failedStay,
        async (tx) => {
          const failedTx = new Proxy(tx, {
            get(target, key) {
              if (key === "auditLog")
                return {
                  create: async () => {
                    throw new Error("injected audit failure");
                  },
                };
              return Reflect.get(target, key);
            },
          });
          const booking = await createReservation(failedStay, { tx: failedTx });
          return { ok: true, data: { id: booking.id } };
        },
      ),
    );
    assert.equal(
      await db.reservation.count({
        where: { hotelId: prefix, roomId: rooms[1].id },
      }),
      0,
    );
    assert.equal(
      await db.operationReceipt.count({
        where: { ...identity, key: failContext.key },
      }),
      0,
    );
    assert.equal(
      await db.availability.count({ where: { hotelId: prefix } }),
      2,
    );
    console.log(
      "PASS: audit failure rolls back booking, inventory changes and receipt.",
    );
    const existing = await db.reservation.findUniqueOrThrow({
      where: { id: first.data!.id },
    });
    await db.$transaction((tx) =>
      updateReservationDetails(
        { ...stay, id: existing.id, checkOut: "2030-01-04" },
        { tx },
      ),
    );
    await db.$transaction((tx) =>
      setReservationStatus(prefix, existing.id, "CANCELLED", { tx }),
    );
    assert.equal(await db.auditLog.count({ where: { hotelId: prefix } }), 3);
    // Notes are additive and thus particularly important to replay exactly once.
    const noteContext = { key: randomUUID(), scope: context.scope };
    const noteWrite = async (tx: Parameters<typeof resolveGuest>[0]) => {
      await tx.guestNote.create({
        data: {
          hotelId: prefix,
          guestId: guestA.id,
          authorId: prefix,
          content: "Synthetic note",
        },
      });
      return { ok: true };
    };
    await executeOperation(
      db,
      identity,
      noteContext,
      "guest.note",
      {},
      noteWrite,
    );
    await executeOperation(
      db,
      identity,
      noteContext,
      "guest.note",
      {},
      noteWrite,
    );
    assert.equal(await db.guestNote.count({ where: { hotelId: prefix } }), 1);
    console.log(
      "PASS: update/status audit is atomic and additive note replay does not duplicate.",
    );
    const ref = await db.channexProperty.create({
      data: {
        hotelId: prefix,
        organizationId: prefix,
        rentalPropertyId: property.id,
        propertyId: prefix,
        provisioningStatus: "READY",
      },
    });
    await db.channexRoomTypeMapping.create({
      data: {
        propertyRefId: ref.id,
        hotelId: prefix,
        organizationId: prefix,
        rentalPropertyId: property.id,
        roomTypeId: type.id,
        channexRoomTypeId: "external-type",
        provisioningStatus: "PROVISIONED",
      },
    });
    const scoped = {
      id: ref.id,
      organizationId: prefix,
      hotelId: prefix,
      rentalPropertyId: property.id,
      propertyId: prefix,
    };
    const revision = {
      id: randomUUID(),
      propertyId: prefix,
      bookingId: "external-booking",
      uniqueId: "external-unique",
      systemId: "same-booking-system-id",
      otaReservationCode: null,
      otaName: "Booking.com",
      status: "new" as const,
      rooms: [
        {
          roomTypeId: "external-type",
          ratePlanId: null,
          otaUniqueId: "one",
          checkIn: "2030-02-01",
          checkOut: "2030-02-03",
          amount: 1000,
          adults: 1,
          children: 0,
        },
        {
          roomTypeId: "external-type",
          ratePlanId: null,
          otaUniqueId: "two",
          checkIn: "2030-02-03",
          checkOut: "2030-02-01",
          amount: 1000,
          adults: 1,
          children: 0,
        },
      ],
      customer: {
        name: "Одинаковое",
        surname: "Имя",
        email: "shared@example.invalid",
        phone: null,
        country: null,
      },
      arrivalHour: null,
      currency: "KZT",
      notes: null,
      insertedAt: "2026-10-14T12:00:00Z",
      amount: 2000,
      otaCommission: 100,
      paymentCollect: null,
      paymentType: null,
      services: [],
    };
    await assert.rejects(processChannexRevision(scoped, revision));
    assert.equal(
      await db.channexBooking.count({ where: { propertyRefId: ref.id } }),
      0,
    );
    assert.equal(
      await db.channexBookingReservation.count({ where: { hotelId: prefix } }),
      0,
    );
    assert.equal(
      await db.reservation.count({
        where: { hotelId: prefix, sourceChannel: "booking" },
      }),
      0,
    );
    assert.equal(await db.guest.count({ where: { hotelId: prefix } }), 2);
    assert.equal(
      await db.channexSyncJob.count({ where: { hotelId: prefix } }),
      0,
    );
    console.log(
      "PASS: failure on second room rolls back first room, guest, links, finances and ARI job.",
    );
    const valid = {
      ...revision,
      rooms: revision.rooms.map((room) => ({
        ...room,
        checkIn: "2030-02-01",
        checkOut: "2030-02-03",
      })),
    };
    await processChannexRevision(scoped, valid);
    await processChannexRevision(scoped, valid);
    assert.equal(
      await db.reservation.count({
        where: { hotelId: prefix, sourceChannel: "booking" },
      }),
      2,
    );
    assert.equal(
      await db.channexBookingReservation.count({ where: { hotelId: prefix } }),
      2,
    );
    assert.equal(await db.guest.count({ where: { hotelId: prefix } }), 3);
    const newer = {
      ...valid,
      id: randomUUID(),
      insertedAt: "2026-10-14T12:02:00Z",
      status: "modified" as const,
      amount: 4000,
      rooms: valid.rooms.map((room) => ({ ...room, amount: 2000 })),
    };
    await processChannexRevision(scoped, newer);
    await processChannexRevision(scoped, {
      ...valid,
      id: randomUUID(),
      insertedAt: "2026-10-14T12:01:00Z",
    });
    const actual = await db.reservation.findMany({
      where: { hotelId: prefix, sourceChannel: "booking" },
    });
    assert.ok(
      actual.every(
        (row) =>
          Number(row.totalAmount) === 2000 &&
          Number(row.channelBookingAmount) === 2000,
      ),
    );
    assert.equal(
      await db.channexBookingRevision.count({
        where: { hotelId: prefix, processingStatus: "PROCESSED" },
      }),
      3,
    );
    await assert.rejects(
      processChannexRevision(scoped, { ...newer, id: randomUUID() }),
    );
    console.log(
      "PASS: revision retry is idempotent, same systemId does not collapse revisions, older events cannot overwrite and equal clocks stop safely.",
    );
    const { importReservationRows } =
      await import("@/lib/reservations/import-service");
    const importResult = await importReservationRows(prefix, [
      {
        sourceRow: 1,
        guestName: "Одинаковое Имя",
        roomNumber: "1",
        checkIn: "2030-03-01",
        checkOut: "2030-03-03",
      },
      {
        sourceRow: 2,
        guestName: "Одинаковое Имя",
        roomNumber: "1",
        checkIn: "2030-03-03",
        checkOut: "2030-03-05",
      },
    ]);
    assert.equal(importResult.imported, 2);
    assert.equal(importResult.errors.length, 0);
    const importedRows = await db.reservation.findMany({
      where: {
        hotelId: prefix,
        checkIn: { gte: new Date("2030-03-01"), lt: new Date("2030-04-01") },
      },
      select: { id: true, guestId: true },
    });
    assert.equal(importedRows.length, 2);
    assert.equal(new Set(importedRows.map((r) => r.guestId)).size, 2);
    assert.ok(
      importedRows.every((r) => ![guestA.id, guestB.id].includes(r.guestId)),
    );
    await db.reservation.deleteMany({
      where: { id: { in: importedRows.map((r) => r.id) } },
    });
    await db.guest.deleteMany({
      where: {
        id: { in: importedRows.map((r) => r.guestId) },
        hotelId: prefix,
      },
    });
    console.log(
      "PASS: Excel rows with identical names create distinct profiles, not a shared guest history.",
    );
    await db.guest.createMany({
      data: Array.from({ length: 157 }, (_, i) => ({
        hotelId: prefix,
        fullName: `Synthetic ${i}`,
        sequenceNumber: i + 100,
      })),
    });
    await db.guestNote.createMany({
      data: Array.from({ length: 44 }, (_, i) => ({
        hotelId: prefix,
        guestId: guestA.id,
        authorId: prefix,
        content: `Note ${i}`,
      })),
    });
    await db.reservation.createMany({
      data: Array.from({ length: 44 }, (_, i) => ({
        hotelId: prefix,
        rentalPropertyId: property.id,
        guestId: guestA.id,
        roomId: rooms[0].id,
        roomTypeId: type.id,
        checkIn: new Date(Date.UTC(2020, 0, i * 2 + 1)),
        checkOut: new Date(Date.UTC(2020, 0, i * 2 + 2)),
        totalAmount: 1000,
        sourceChannel: "direct",
        status: "CHECKED_OUT",
      })),
    });
    const list = await loadGuestPage(db, prefix, {});
    assert.equal(list.rows.length, 50);
    assert.equal(list.total, 160);
    assert.equal(list.reservations.length, 0);
    assert.ok(list.rows.every((g) => g.internalNotes.length === 0));
    const detail = await loadGuestPage(db, prefix, {
      guest: guestA.id,
      stays: "2",
      notes: "2",
    });
    assert.ok(detail.rows.length <= 51);
    assert.equal(detail.reservations.length, 20);
    assert.equal(detail.detailCounts, 45);
    assert.equal(detail.notesTotal, 45);
    assert.equal(
      detail.rows.find((g) => g.id === guestA.id)?.internalNotes.length,
      20,
    );
    const third = await loadGuestPage(db, prefix, {
      guest: guestA.id,
      stays: "3",
      notes: "3",
    });
    assert.equal(third.reservations.length, 5);
    assert.equal(
      third.rows.find((g) => g.id === guestA.id)?.internalNotes.length,
      5,
    );
    const search = await loadGuestPage(db, prefix, { q: "Synthetic 156" });
    assert.equal(search.total, 1);
    const foreign = await loadGuestPage(db, prefix, {
      guest: "another-tenant-id",
    });
    assert.equal(foreign.reservations.length, 0);
    assert.equal(foreign.notesTotal, 0);
    console.log(
      "PASS: 160 guest profiles return 50 list rows; selected history/notes are bounded to 20, pages/search and tenant isolation hold.",
    );
  } finally {
    if (created) {
      await db.channexBookingRevision.deleteMany({
        where: { hotelId: prefix },
      });
      await db.channexBookingReservation.deleteMany({
        where: { hotelId: prefix },
      });
      await db.channexBooking.deleteMany({ where: { hotelId: prefix } });
      await db.reservation.deleteMany({ where: { hotelId: prefix } });
      await db.organization.delete({ where: { id: prefix } });
      await db.user.delete({ where: { id: prefix } });
    }
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
