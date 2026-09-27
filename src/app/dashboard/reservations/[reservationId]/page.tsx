import { notFound } from "next/navigation";
import { db, getCurrentHotelId } from "@/lib/db";
import { getRequestLocale } from "@/lib/locale-server";
import { toReservationVM } from "@/lib/types";
import { MobileReservationDetail } from "@/components/reservations/mobile-reservation-detail";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params }: { params: Promise<{ reservationId: string }> }) {
  await requireSectionAccess("RESERVATIONS");
  const [{ reservationId }, hotelId, locale] = await Promise.all([params, getCurrentHotelId(), getRequestLocale()]);
  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, hotelId },
    include: {
      guest: { select: { id: true, fullName: true, email: true, phone: true, country: true } },
      room: { select: { id: true, number: true, floor: true, roomTypeId: true } },
      roomType: { select: { id: true, name: true } },
    },
  });
  if (!reservation) notFound();
  return <MobileReservationDetail reservation={toReservationVM(reservation)} locale={locale} />;
}
