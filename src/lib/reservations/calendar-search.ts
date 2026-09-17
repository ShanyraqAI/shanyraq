import { reservationDisplayId, type ReservationVM } from "@/lib/types";

export function reservationMatchesCalendarSearch(reservation: ReservationVM, query: string): boolean {
  if (!query) return true;
  const reference = reservationDisplayId(reservation.sequenceNumber);
  return [
    reservation.guestName,
    reservation.guestPhone,
    reservation.guestEmail,
    reservation.roomNumber,
    reservation.roomTypeName,
    reference,
    reservation.externalReservationId,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(query));
}
