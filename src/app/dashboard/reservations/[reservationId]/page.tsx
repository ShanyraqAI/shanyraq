import { notFound } from "next/navigation";
import { db, getCurrentHotelId } from "@/lib/db";
import { getRequestLocale } from "@/lib/locale-server";
import { toReservationVM, type GuestVM, type RatePlanVM, type RoomVM } from "@/lib/types";
import { MobileReservationDetail } from "@/components/reservations/mobile-reservation-detail";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params }: { params: Promise<{ reservationId: string }> }) {
  await requireSectionAccess("RESERVATIONS");
  const [{ reservationId }, hotelId, locale] = await Promise.all([params, getCurrentHotelId(), getRequestLocale()]);
  const [reservation, connection] = await Promise.all([db.reservation.findFirst({
    where: { id: reservationId, hotelId },
    include: {
      guest: { select: { id: true, fullName: true, email: true, phone: true, country: true } },
      room: { select: { id: true, number: true, floor: true, roomTypeId: true, ttlockLock: { select: { id: true } } } },
      roomType: { select: { id: true, name: true } },
    },
  }), db.tTLockConnection.findUnique({ where: { hotelId }, select: { id: true } })]);
  if (!reservation) notFound();
  const [hotel, roomsRaw, ratePlansRaw, guestsRaw] = await Promise.all([
    db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true } }),
    db.room.findMany({ where: { hotelId }, include: { roomType: { select: { name: true } } }, orderBy: { number: "asc" } }),
    db.ratePlan.findMany({ where: { hotelId }, include: { roomType: { select: { name: true } } }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
  ]);
  const rooms: RoomVM[] = roomsRaw.map((r) => ({ id: r.id, number: r.number, floor: r.floor, status: r.status as RoomVM["status"], roomTypeId: r.roomTypeId, roomTypeName: r.roomType.name, guestTonight: null }));
  const ratePlans: RatePlanVM[] = ratePlansRaw.map((p) => ({ id: p.id, sequenceNumber: p.sequenceNumber, name: p.name, roomTypeId: p.roomTypeId, roomTypeName: p.roomType.name, basePrice: Number(p.basePrice), currency: p.currency, refundable: p.refundable, breakfastIncluded: p.breakfastIncluded }));
  const guests: GuestVM[] = guestsRaw.map((g) => ({ id: g.id, sequenceNumber: g.sequenceNumber, fullName: g.fullName, email: g.email, phone: g.phone, country: g.country, notes: g.notes }));
  const ttlockPasscode = await db.tTLockPasscode.findFirst({ where: { hotelId, reservationId, status: "ACTIVE", endsAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { code: true, startsAt: true, endsAt: true } });
  return <MobileReservationDetail reservation={toReservationVM(reservation)} rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotel.currency} locale={locale} ttlockReady={Boolean(connection && reservation.room.ttlockLock)} ttlockPasscode={ttlockPasscode ? { ...ttlockPasscode, startsAt: ttlockPasscode.startsAt.toISOString(), endsAt: ttlockPasscode.endsAt.toISOString() } : null} />;
}
