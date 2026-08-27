/**
 * Business-logic smoke test: runs a real channel sync + reservation flows
 * against the seeded database, then restores state via db:reset.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Lazy-import app services after env is set.
  const { runChannelSync } = await import("../src/lib/channels/sync-service");
  const { createReservation, OverbookingError } = await import("../src/lib/reservations/service");

  const hotel = await db.hotel.findFirstOrThrow({ where: { slug: "shanyraq-astana" } });

  // ---------------------------------------------------------------- sync test
  const bookingConn = await db.channelConnection.findFirstOrThrow({
    where: { hotelId: hotel.id, channelId: "booking" },
    include: { channel: true },
  });
  console.log("== Running Booking.com mock sync ==");
  const summary = await runChannelSync(bookingConn.id);
  console.log("Sync result:", summary.status, "| imported:", summary.reservationsImported, "| rates:", summary.ratesUpdated, "| avail:", summary.availabilityUpdated);
  console.log("Message:", summary.message);
  if (summary.reservationsImported === 0) throw new Error("Expected at least one import");
  const log = await db.syncLog.findUniqueOrThrow({ where: { id: summary.logId } });
  if (!log.finishedAt) throw new Error("Sync log not finalized");

  // Imported reservations must exist with external ids.
  const imported = await db.reservation.count({
    where: { hotelId: hotel.id, sourceChannel: "booking", externalReservationId: { not: null }, notes: { contains: "демо-канал" } },
  });
  if (imported < 1) throw new Error("Imported reservations missing in DB");
  console.log("Imported rows found:", imported);

  // Availability must never be negative.
  const negatives = await db.availability.count({ where: { hotelId: hotel.id, availableRooms: { lt: 0 } } });
  if (negatives > 0) throw new Error("Negative availability detected!");
  console.log("No negative availability ✓");

  // --------------------------------------------------- overbooking protection
  console.log("== Overbooking protection test ==");
  const standard = await db.roomType.findFirstOrThrow({ where: { hotelId: hotel.id, name: "Стандарт" } });
  const stdRooms = await db.room.findMany({ where: { roomTypeId: standard.id } });

  // Find the farthest future window with zero load on Standard.
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  const start = new Date(base.getTime() + 30 * 86_400_000);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  for (let i = 0; i < stdRooms.length; i++) {
    await createReservation({
      hotelId: hotel.id,
      guestId: (await db.guest.findFirstOrThrow({ where: { hotelId: hotel.id } })).id,
      roomId: stdRooms[i].id,
      ratePlanId: (await db.ratePlan.findFirstOrThrow({ where: { roomTypeId: standard.id } })).id,
      checkIn: start.toISOString().slice(0, 10),
      checkOut: end.toISOString().slice(0, 10),
      adults: 1,
      children: 0,
      sourceChannel: "direct",
    });
  }
  try {
    await createReservation({
      hotelId: hotel.id,
      guestId: (await db.guest.findFirstOrThrow({ where: { hotelId: hotel.id } })).id,
      roomId: stdRooms[0].id,
      ratePlanId: (await db.ratePlan.findFirstOrThrow({ where: { roomTypeId: standard.id } })).id,
      checkIn: start.toISOString().slice(0, 10),
      checkOut: end.toISOString().slice(0, 10),
      adults: 1,
      children: 0,
      sourceChannel: "direct",
    });
    throw new Error("Overbooked reservation was accepted — BUG");
  } catch (e) {
    if (e instanceof OverbookingError) {
      console.log("Room clash blocked ✓ —", e.message);
    } else {
      throw e;
    }
  }

  // Type-level guard: with every physical unit booked, the type reports sold
  // out and further channel demand would be refused before assignment.
  const otherStdRoom = await db.room.create({
    data: { hotelId: hotel.id, number: "999", floor: 9, roomTypeId: standard.id },
  });
  await createReservation({
    hotelId: hotel.id,
    guestId: (await db.guest.findFirstOrThrow({ where: { hotelId: hotel.id } })).id,
    roomId: otherStdRoom.id,
    ratePlanId: (await db.ratePlan.findFirstOrThrow({ where: { roomTypeId: standard.id } })).id,
    checkIn: start.toISOString().slice(0, 10),
    checkOut: end.toISOString().slice(0, 10),
    adults: 1,
    children: 0,
    sourceChannel: "direct",
  });

  const { hasAvailabilityForStay } = await import("../src/lib/reservations/service");
  const soldOut = await db.availability.findFirstOrThrow({
    where: { hotelId: hotel.id, roomTypeId: standard.id, date: start },
  });
  console.log("Standard availability on target night:", soldOut.availableRooms);
  if (!(soldOut.availableRooms === 0 && !(await hasAvailabilityForStay(hotel.id, standard.id, start, end)))) {
    throw new Error("Sold-out type still reported available — BUG");
  }
  console.log("Type-level overbooking protection ✓");
  await db.room.delete({ where: { id: otherStdRoom.id } }).catch(() => {});

  console.log("\nALL SMOKE TESTS PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
