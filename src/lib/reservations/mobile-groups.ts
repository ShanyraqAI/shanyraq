import type { ReservationVM } from "@/lib/types";

export function groupMobileReservations<T extends Pick<ReservationVM, "checkIn" | "checkOut">>(
  reservations: T[],
  todayISO: string,
  tomorrowISO: string,
) {
  const sorted = [...reservations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return [
    { key: "today", rows: sorted.filter((row) => row.checkIn <= todayISO && row.checkOut >= todayISO) },
    { key: "tomorrow", rows: sorted.filter((row) => row.checkIn === tomorrowISO) },
    { key: "later", rows: sorted.filter((row) => row.checkIn > tomorrowISO) },
    { key: "earlier", rows: sorted.filter((row) => row.checkOut < todayISO).reverse() },
  ].filter((group) => group.rows.length > 0);
}
