import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { requireSectionAccess } from "@/server/guards";
import { hasHotelPermission } from "@/lib/access";
import { getRequestLocale } from "@/lib/locale-server";
import { todayInTimeZone, toISODate } from "@/lib/dates";
import { ApartmentCalendar } from "@/components/calendar/apartment-calendar";
export const dynamic = "force-dynamic";

export default async function ApartmentCalendarPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  await requireSectionAccess("CALENDAR");
  const member = await getCurrentMembership();
  if (!member) notFound();
  const { roomId } = await params;
  const [room, hotel, locale] = await Promise.all([
    db.room.findFirst({
      where: { id: roomId, hotelId: member.hotelId },
      select: { id: true, number: true },
    }),
    db.hotel.findUniqueOrThrow({
      where: { id: member.hotelId },
      select: {
        timezone: true,
        defaultCheckInTime: true,
        defaultCheckOutTime: true,
      },
    }),
    getRequestLocale(),
  ]);
  if (!room) notFound();
  return (
    <ApartmentCalendar
      roomId={room.id}
      roomName={room.number}
      locale={locale}
      scope={`${member.userId}:${member.hotelId}`}
      todayISO={toISODate(todayInTimeZone(hotel.timezone))}
      checkInTime={hotel.defaultCheckInTime}
      checkOutTime={hotel.defaultCheckOutTime}
      canBook={hasHotelPermission(member, "RESERVATIONS")}
    />
  );
}
