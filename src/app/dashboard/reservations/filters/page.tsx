import { getAllReservations } from "@/lib/stats";
import { toReservationVM } from "@/lib/types";
import { getCurrentHotelId } from "@/lib/db";
import { getRequestLocale } from "@/lib/locale-server";
import { MobileReservationFilters } from "@/components/reservations/mobile-reservation-filters";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string | string[]; channel?: string | string[]; debt?: string | string[] }>;

export default async function ReservationFiltersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSectionAccess("RESERVATIONS");
  const [hotelId, locale, params] = await Promise.all([getCurrentHotelId(), getRequestLocale(), searchParams]);
  const reservations = await getAllReservations(hotelId);
  const rows = reservations.map(toReservationVM).map(({ status, channel, paymentMethod }) => ({ status, channel, paymentMethod: paymentMethod ?? null }));
  return <MobileReservationFilters
    locale={locale}
    rows={rows}
    initialStatus={typeof params.status === "string" ? params.status : "all"}
    initialChannel={typeof params.channel === "string" ? params.channel : "all"}
    initialDebt={params.debt === "1"}
  />;
}
