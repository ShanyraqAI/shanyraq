import { db, getCurrentHotelId } from "@/lib/db";
import { getAllReservations } from "@/lib/stats";
import { toReservationVM, type GuestVM, type RatePlanVM, type RoomVM } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { ReservationsTable } from "@/components/reservations/reservations-table";
import { requireSectionAccess } from "@/server/guards";
import { todayInTimeZone, toISODate } from "@/lib/dates";
import { getRequestLocale } from "@/lib/locale-server";
import { mobileCopy } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ reservation?: string | string[]; status?: string | string[]; channel?: string | string[]; debt?: string | string[]; period?: string | string[] }> }) {
  await requireSectionAccess("RESERVATIONS");
  const hotelId = await getCurrentHotelId();
  const params = await searchParams;
  const initialSelectedId = typeof params.reservation === "string" ? params.reservation : null;
  const [hotel, roomsRaw, roomTypes, ratePlansRaw, guestsRaw, reservations] = await Promise.all([
    db.hotel.findUniqueOrThrow({ where: { id: hotelId } }),
    db.room.findMany({
      where: { hotelId },
      include: { roomType: { select: { name: true } } },
      orderBy: { number: "asc" },
    }),
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" } }),
    db.ratePlan.findMany({ where: { hotelId }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
    getAllReservations(hotelId),
  ]);
  const locale = await getRequestLocale(hotel.language);
  const copy = mobileCopy[locale].reservations;
  const reservationsVM = reservations.map(toReservationVM);
  const initialStatus = typeof params.status === "string" ? params.status : "all";
  const initialChannel = typeof params.channel === "string" ? params.channel : "all";
  const initialDebt = params.debt === "1";
  const initialPeriod = params.period === "arrivals" || params.period === "departures" || params.period === "today" ? params.period : "all";
  const filteredReservationCount = reservationsVM.filter((reservation) =>
    (initialStatus === "all" || reservation.status === initialStatus) &&
    (initialChannel === "all" || reservation.channel === initialChannel) &&
    (!initialDebt || reservation.paymentMethod !== "ONLINE")
  ).length;

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
    roomTypeName: roomTypes.find((t) => t.id === p.roomTypeId)?.name ?? "",
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
    <div>
      <div className="hidden sm:block"><PageHeader
        title={copy.title}
        description={copy.description}
      /></div>
      <header className="mb-4 sm:hidden"><h1 className="sh-mobile-title">{copy.title}</h1><p className="sh-mobile-eyebrow">{filteredReservationCount} {locale === "kk" ? "бронь сүзгі бойынша" : "броней по фильтру"}</p></header>
      <ReservationsTable
        reservations={reservationsVM}
        rooms={rooms}
        ratePlans={ratePlans}
        guests={guests}
        hotelCurrency={hotel.currency}
        todayISO={toISODate(todayInTimeZone(hotel.timezone))}
        initialSelectedId={initialSelectedId}
        locale={locale}
        initialStatus={initialStatus}
        initialChannel={initialChannel}
        initialDebt={initialDebt}
        initialPeriod={initialPeriod}
      />
    </div>
  );
}
