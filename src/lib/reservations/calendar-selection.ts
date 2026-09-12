import type { ReservationVM } from "@/lib/types";

export function findSelectedReservation(
  reservations: readonly ReservationVM[],
  selectedId: string | null,
): ReservationVM | null {
  return selectedId ? reservations.find((reservation) => reservation.id === selectedId) ?? null : null;
}
