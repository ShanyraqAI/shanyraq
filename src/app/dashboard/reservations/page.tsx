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

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ reservation?: string | string[]; new?: string | string[] }> }) {
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
      <PageHeader
        title={copy.title}
        description={copy.description}
      />
      <ReservationsTable
        reservations={reservations.map(toReservationVM)}
        rooms={rooms}
        ratePlans={ratePlans}
        guests={guests}
        hotelCurrency={hotel.currency}
        todayISO={toISODate(todayInTimeZone(hotel.timezone))}
        initialSelectedId={initialSelectedId}
        initialCreateOpen={params.new === "1"}
        locale={locale}
      />
    </div>
  );
}
