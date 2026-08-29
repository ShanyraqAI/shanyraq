import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { toReservationVM, type GuestVM, type RatePlanVM, type RoomVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireSectionAccess("CALENDAR");
  const hotelId = await getCurrentHotelId();
  const [hotel, roomTypes, roomsRaw, ratePlansRaw, guestsRaw, reservationsRaw] = await Promise.all([
    db.hotel.findUniqueOrThrow({ where: { id: hotelId } }),
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" } }),
    db.room.findMany({
      where: { hotelId },
      include: { roomType: { select: { name: true } } },
      orderBy: { number: "asc" },
    }),
    db.ratePlan.findMany({ where: { hotelId }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
    db.reservation.findMany({
      where: { hotelId },
      include: {
        guest: { select: { id: true, fullName: true, email: true, phone: true, country: true } },
        room: { select: { id: true, number: true, floor: true, roomTypeId: true } },
        roomType: { select: { id: true, name: true } },
      },
      orderBy: { checkIn: "asc" },
    }),
  ]);

  // Which guest occupies each room tonight (for the label hint).
  const todayISO = new Date().toISOString().slice(0, 10);
  const tonightByRoom = new Map<string, string>();
  for (const r of reservationsRaw) {
    const inHouse =
      r.checkIn.toISOString().slice(0, 10) <= todayISO && r.checkOut.toISOString().slice(0, 10) > todayISO;
    if (inHouse && ["CHECKED_IN", "CONFIRMED"].includes(r.status)) {
      if (!tonightByRoom.has(r.room.id)) tonightByRoom.set(r.room.id, r.guest.fullName);
    }
  }

  const rooms: RoomVM[] = roomsRaw.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    status: r.status as RoomVM["status"],
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    guestTonight: tonightByRoom.get(r.id) ?? null,
  }));
  const ratePlans: RatePlanVM[] = ratePlansRaw.map((p) => ({
    id: p.id,
    name: p.name,
    roomTypeId: p.roomTypeId,
    roomTypeName: roomTypes.find((t) => t.id === p.roomTypeId)?.name ?? "",
    basePrice: p.basePrice,
    currency: p.currency,
    refundable: p.refundable,
    breakfastIncluded: p.breakfastIncluded,
  }));
  const guests: GuestVM[] = guestsRaw.map((g) => ({
    id: g.id,
    fullName: g.fullName,
    email: g.email,
    phone: g.phone,
    country: g.country,
    notes: g.notes,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.calendar.title}
        description={t.calendar.description(rooms.length)}
      />
      <CalendarBoard
        rooms={rooms}
        reservations={reservationsRaw.map(toReservationVM)}
        ratePlans={ratePlans}
        guests={guests}
        hotelCurrency={hotel.currency}
        initialView="week"
      />
    </div>
  );
}
