import { db, getCurrentHotel } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { toReservationVM, type GuestVM, type RatePlanVM, type RoomVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";
import { toISODate, todayInTimeZone } from "@/lib/dates";
import { calendarTimelineRange, parseCalendarNavigation, parseCalendarRange } from "@/lib/reservations/calendar-range";
import { CalendarOpenTracker } from "@/components/analytics/calendar-open-tracker";
import { getCurrentMembership } from "@/lib/tenant";
import { DEFAULT_CALENDAR_PREFERENCES, type CalendarDensity } from "@/components/calendar/types";
import { hasHotelPermission } from "@/lib/access";
import { getRequestLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

type CalendarSearchParams = Promise<{
  date?: string | string[];
  range?: string | string[];
}>;

export default async function CalendarPage({ searchParams }: { searchParams: CalendarSearchParams }) {
  await requireSectionAccess("CALENDAR");
  const hotel = await getCurrentHotel();
  const hotelId = hotel.id;
  const locale = await getRequestLocale();
  const membership = await getCurrentMembership();
  const params = await searchParams;
  const todayISO = toISODate(todayInTimeZone(hotel.timezone));
  const { anchorISO } = parseCalendarNavigation(params.date, params.range, todayISO);
  const savedPreferences = membership ? await db.calendarPreference.findUnique({
    where: { userId_hotelId: { userId: membership.userId, hotelId } },
  }) : null;
  const rangeDays = params.range === undefined ? parseCalendarRange(String(savedPreferences?.rangeDays ?? 14)) : parseCalendarRange(params.range);
  const range = calendarTimelineRange(anchorISO, rangeDays);
  const [roomTypes, roomsRaw, ratePlansRaw, guestsRaw, reservationsRaw] = await Promise.all([
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" } }),
    db.room.findMany({
      where: { hotelId },
      include: { roomType: { select: { name: true } } },
      orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
    }),
    db.ratePlan.findMany({ where: { hotelId }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
    db.reservation.findMany({
      where: {
        hotelId,
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

  const roomTypeOrder = new Map(roomTypes.map((roomType, index) => [roomType.id, index]));
  const rooms: RoomVM[] = roomsRaw.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    status: r.status as RoomVM["status"],
    sortOrder: r.sortOrder,
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    guestTonight: null,
  })).sort((a, b) => (roomTypeOrder.get(a.roomTypeId) ?? 0) - (roomTypeOrder.get(b.roomTypeId) ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.number.localeCompare(b.number, "ru", { numeric: true }));
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
      <div className="hidden sm:block"><PageHeader
        title={t.calendar.title}
        description={`${rooms.length} номеров · ${rangeDays} дней · перетаскивайте брони прямо на таймлайне`}
      /></div>
      <CalendarBoard
        rooms={rooms}
        reservations={reservationsRaw.map(toReservationVM)}
        ratePlans={ratePlans}
        guests={guests}
        canReorderRooms={Boolean(membership && hasHotelPermission(membership, "ROOMS"))}
        hotelCurrency={hotel.currency}
        todayISO={todayISO}
        rangeDays={rangeDays}
        initialAnchor={anchorISO}
        initialPreferences={savedPreferences ? {
          density: savedPreferences.density as CalendarDensity,
          rangeDays: parseCalendarRange(String(savedPreferences.rangeDays)),
          roomColumnWidth: savedPreferences.roomColumnWidth as "COMPACT" | "STANDARD" | "WIDE",
          showGuestName: savedPreferences.showGuestName,
          showGuestCount: savedPreferences.showGuestCount,
          showChannel: savedPreferences.showChannel,
          showAmount: savedPreferences.showAmount,
          showReservationId: savedPreferences.showReservationId,
          showNotes: savedPreferences.showNotes,
          currencyDisplay: savedPreferences.currencyDisplay as "SYMBOL" | "CODE" | "HIDDEN",
          reservationColors: savedPreferences.reservationColors as "BRIGHT" | "CALM",
          collapsedRoomTypeIds: savedPreferences.collapsedRoomTypeIds,
        } : DEFAULT_CALENDAR_PREFERENCES}
        locale={locale}
      />
    </div>
  );
}
