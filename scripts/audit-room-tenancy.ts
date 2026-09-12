import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [rooms, reservations, memberships, duplicateRooms, duplicateTypes] = await Promise.all([
    db.room.findMany({
      select: { id: true, hotelId: true, roomType: { select: { hotelId: true } } },
    }),
    db.reservation.findMany({
      select: {
        id: true,
        hotelId: true,
        room: { select: { hotelId: true } },
        roomType: { select: { hotelId: true } },
      },
    }),
    db.membership.findMany({
      select: { id: true, organizationId: true, hotel: { select: { orgId: true } } },
    }),
    db.room.groupBy({
      by: ["hotelId", "number"],
      _count: { _all: true },
      having: { number: { _count: { gt: 1 } } },
    }),
    db.roomType.groupBy({
      by: ["hotelId", "name"],
      _count: { _all: true },
      having: { name: { _count: { gt: 1 } } },
    }),
  ]);

  const crossHotelRooms = rooms.filter((room) => room.hotelId !== room.roomType.hotelId);
  const crossHotelReservations = reservations.filter(
    (reservation) =>
      reservation.hotelId !== reservation.room.hotelId ||
      reservation.hotelId !== reservation.roomType.hotelId,
  );
  const crossOrganizationMemberships = memberships.filter(
    (membership) => membership.hotel.orgId !== membership.organizationId,
  );

  const failures = {
    crossHotelRooms: crossHotelRooms.length,
    crossHotelReservations: crossHotelReservations.length,
    crossOrganizationMemberships: crossOrganizationMemberships.length,
    duplicateRoomNumbersWithinHotel: duplicateRooms.length,
    duplicateRoomTypesWithinHotel: duplicateTypes.length,
  };

  console.log(JSON.stringify({ rooms: rooms.length, reservations: reservations.length, ...failures }, null, 2));
  if (Object.values(failures).some((count) => count > 0)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
