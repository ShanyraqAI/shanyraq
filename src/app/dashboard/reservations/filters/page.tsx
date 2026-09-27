import { db, getCurrentHotelId } from "@/lib/db";
import { getRequestLocale } from "@/lib/locale-server";
import { MobileReservationFilters } from "@/components/reservations/mobile-reservation-filters";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function ReservationFiltersPage() {
  await requireSectionAccess("RESERVATIONS");
  const [hotelId, locale] = await Promise.all([getCurrentHotelId(), getRequestLocale()]);
  const count = await db.reservation.count({ where: { hotelId } });
  return <MobileReservationFilters locale={locale} count={count} />;
}
