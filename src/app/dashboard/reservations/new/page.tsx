import { db, getCurrentHotelId } from "@/lib/db";
import { getRequestLocale } from "@/lib/locale-server";
import { todayInTimeZone, toISODate } from "@/lib/dates";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import { MobileNewReservation } from "@/components/reservations/mobile-new-reservation";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  await requireSectionAccess("RESERVATIONS");
  const hotelId = await getCurrentHotelId();
  const [hotel, locale, roomsRaw, roomTypes, plansRaw, guestsRaw] = await Promise.all([
    db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { timezone: true } }),
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
  return <MobileNewReservation locale={locale} todayISO={toISODate(todayInTimeZone(hotel.timezone))} rooms={rooms} ratePlans={plans} guests={guests} />;
}
