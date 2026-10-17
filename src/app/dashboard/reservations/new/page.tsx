import { bookingGuestCount } from "@/lib/reservations/calendar-navigation";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getRequestLocale } from "@/lib/locale-server";
import { isISODate, todayInTimeZone, toISODate } from "@/lib/dates";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import { MobileNewReservation } from "@/components/reservations/mobile-new-reservation";
import { getCurrentMembership } from "@/lib/tenant";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<{ checkIn?: string | string[]; checkOut?: string | string[]; roomId?: string | string[]; datesSelected?: string | string[]; adults?: string | string[]; children?: string | string[] }> }) {
  await requireSectionAccess("RESERVATIONS");
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const params = await searchParams;
  const hotelId = membership.hotelId;
  const [hotel, locale, roomsRaw, roomTypes, plansRaw, guestsRaw] = await Promise.all([
    db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { timezone: true, defaultCheckInTime: true, defaultCheckOutTime: true } }),
    getRequestLocale(),
    db.room.findMany({ where: { hotelId, status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] } }, include: { roomType: { select: { name: true, capacity: true, basePrice: true } } }, orderBy: { number: "asc" } }),
    db.roomType.findMany({ where: { hotelId }, select: { id: true, name: true } }),
    db.ratePlan.findMany({ where: { hotelId }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
  ]);
  const names = new Map(roomTypes.map((type) => [type.id, type.name]));
  const rooms: RoomVM[] = roomsRaw.map((room) => ({ id: room.id, number: room.number, floor: room.floor, status: room.status as RoomVM["status"], roomTypeId: room.roomTypeId, roomTypeName: room.roomType.name, capacity: room.roomType.capacity, basePrice: Number(room.roomType.basePrice), guestTonight: null }));
  const plans: RatePlanVM[] = plansRaw.map((plan) => ({ id: plan.id, sequenceNumber: plan.sequenceNumber, name: plan.name, roomTypeId: plan.roomTypeId, roomTypeName: names.get(plan.roomTypeId) ?? "", basePrice: Number(plan.basePrice), currency: plan.currency, refundable: plan.refundable, breakfastIncluded: plan.breakfastIncluded }));
  const guests: GuestVM[] = guestsRaw.map((guest) => ({ id: guest.id, sequenceNumber: guest.sequenceNumber, fullName: guest.fullName, email: guest.email, phone: guest.phone, country: guest.country, notes: guest.notes }));
  const todayISO = toISODate(todayInTimeZone(hotel.timezone));
  const requestedCheckIn = typeof params.checkIn === "string" ? params.checkIn : undefined;
  const requestedCheckOut = typeof params.checkOut === "string" ? params.checkOut : undefined;
  const requestedRoomId = typeof params.roomId === "string" ? params.roomId : undefined;
  const validCheckIn = requestedCheckIn && isISODate(requestedCheckIn) ? requestedCheckIn : undefined;
  const validCheckOut = requestedCheckOut && isISODate(requestedCheckOut) ? requestedCheckOut : undefined;
  if (requestedRoomId && !rooms.some((room) => room.id === requestedRoomId)) notFound();
  const validRoomId = requestedRoomId && rooms.some((room) => room.id === requestedRoomId) ? requestedRoomId : undefined;
  return <MobileNewReservation locale={locale} todayISO={todayISO} defaultCheckInTime={hotel.defaultCheckInTime} defaultCheckOutTime={hotel.defaultCheckOutTime} rooms={rooms} ratePlans={plans} guests={guests} scope={`${membership.userId}:${membership.hotelId}`} initialCheckIn={validCheckIn} initialCheckOut={validCheckOut} initialRoomId={validRoomId} datesSelected={params.datesSelected === "1"} initialAdults={bookingGuestCount(params.adults, Math.min(2, rooms.find((room) => room.id === validRoomId)?.capacity ?? 2), 1)} initialChildren={bookingGuestCount(params.children, 0, 0)} />;
}
