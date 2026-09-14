import { db, getCurrentHotel } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { toReservationVM, type GuestVM, type RatePlanVM, type RoomVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";
import { toISODate, todayInTimeZone } from "@/lib/dates";
import { calendarTimelineRange, parseCalendarNavigation } from "@/lib/reservations/calendar-range";
import { CalendarOpenTracker } from "@/components/analytics/calendar-open-tracker";

export const dynamic = "force-dynamic";

type CalendarSearchParams = Promise<{
  date?: string | string[];
  range?: string | string[];
}>;

export default async function CalendarPage({ searchParams }: { searchParams: CalendarSearchParams }) {
  await requireSectionAccess("CALENDAR");
  const hotel = await getCurrentHotel();
  const hotelId = hotel.id;
  const params = await searchParams;
  const todayISO = toISODate(todayInTimeZone(hotel.timezone));
  const { anchorISO, rangeDays } = parseCalendarNavigation(params.date, params.range, todayISO);
  const range = calendarTimelineRange(anchorISO, rangeDays);
  const [roomTypes, roomsRaw, ratePlansRaw, guestsRaw, reservationsRaw] = await Promise.all([
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" } }),
    db.room.findMany({
      where: { hotelId },
      include: { roomType: { select: { name: true } } },
      orderBy: { number: "asc" },
    }),
    db.ratePlan.findMany({ where: { hotelId }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
    db.reservation.findMany({
      where: {
        hotelId,
        status: { not: "CANCELLED" },
        checkIn: { lt: range.endExclusive },
        checkOut: { gt: range.start },
      },
      include: {
        guest: { select: { id: true, fullName: true, email: true, phone: true, country: true } },
        room: { select: { id: true, number: true, floor: true, roomTypeId: true } },
        roomType: { select: { id: true, name: true } },
      },
      orderBy: { checkIn: "asc" },
    }),
  ]);

  const roomTypeNames = new Map(roomTypes.map((roomType) => [roomType.id, roomType.name]));

  const rooms: RoomVM[] = roomsRaw.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    status: r.status as RoomVM["status"],
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    guestTonight: null,
  }));
  const ratePlans: RatePlanVM[] = ratePlansRaw.map((p) => ({
    id: p.id,
    sequenceNumber: p.sequenceNumber,
    name: p.name,
    roomTypeId: p.roomTypeId,
    roomTypeName: roomTypeNames.get(p.roomTypeId) ?? "",
    basePrice: Number(p.basePrice),
    currency: p.currency,
    refundable: p.refundable,
    breakfastIncluded: p.breakfastIncluded,
  }));
  const guests: GuestVM[] = guestsRaw.map((g) => ({
    id: g.id,
    sequenceNumber: g.sequenceNumber,
    fullName: g.fullName,
    email: g.email,
    phone: g.phone,
    country: g.country,
    notes: g.notes,
  }));

  return (
    <div className="space-y-6">
      <CalendarOpenTracker rangeDays={rangeDays} />
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
        todayISO={todayISO}
        rangeDays={rangeDays}
        initialAnchor={anchorISO}
      />
    </div>
  );
}
