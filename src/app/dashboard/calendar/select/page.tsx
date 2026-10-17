import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { requireSectionAccess } from "@/server/guards";
import { hasHotelPermission } from "@/lib/access";
import { getRequestLocale } from "@/lib/locale-server";
import { isISODate, todayInTimeZone, toISODate } from "@/lib/dates";
import { ApartmentCalendar } from "@/components/calendar/apartment-calendar";

export const dynamic = "force-dynamic";

type Params = { roomId?: string | string[]; checkIn?: string | string[] };
export default async function CalendarSelectionPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireSectionAccess("CALENDAR");
  const member = await getCurrentMembership();
  if (!member) notFound();
  const params = await searchParams;
  if (
    params.roomId !== undefined &&
    (typeof params.roomId !== "string" || !params.roomId)
  )
    notFound();
  const roomId = typeof params.roomId === "string" ? params.roomId : undefined;
  const [hotel, locale, room] = await Promise.all([
    db.hotel.findUniqueOrThrow({
      where: { id: member.hotelId },
      select: {
        timezone: true,
        defaultCheckInTime: true,
        defaultCheckOutTime: true,
      },
    }),
    getRequestLocale(),
    roomId
      ? db.room.findFirst({
          where: { id: roomId, hotelId: member.hotelId },
          select: { id: true, number: true },
        })
      : Promise.resolve(null),
  ]);
  // A foreign/missing apartment never silently becomes a generic selection.
  if (roomId && !room) notFound();
  const todayISO = toISODate(todayInTimeZone(hotel.timezone));
  const requestedDate =
    typeof params.checkIn === "string" ? params.checkIn : undefined;
  const initialCheckIn =
    requestedDate && isISODate(requestedDate) && requestedDate >= todayISO
      ? requestedDate
      : undefined;
  return (
    <ApartmentCalendar
      key={`${member.userId}:${member.hotelId}:${roomId ?? "all"}:${initialCheckIn ?? ""}`}
      roomId={room?.id}
      roomName={room?.number}
      locale={locale}
      scope={`${member.userId}:${member.hotelId}`}
      todayISO={todayISO}
      checkInTime={hotel.defaultCheckInTime}
      checkOutTime={hotel.defaultCheckOutTime}
      canBook={hasHotelPermission(member, "RESERVATIONS")}
      initialCheckIn={initialCheckIn}
      returnTo="calendar"
    />
  );
}
