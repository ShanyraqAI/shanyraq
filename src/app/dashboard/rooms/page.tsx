import { Users } from "lucide-react";
import { db, getCurrentHotelId } from "@/lib/db";
import { today, toISODate } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { RoomsGrid } from "@/components/rooms/rooms-grid";
import { t } from "@/lib/i18n";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const hotelId = await getCurrentHotelId();
  const day = today();

  const [roomTypes, roomsRaw, availabilityToday] = await Promise.all([
    db.roomType.findMany({
      where: { hotelId },
      include: { rooms: { orderBy: { number: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    db.room.findMany({
      where: { hotelId },
      include: { roomType: { select: { name: true } } },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
    db.availability.findMany({ where: { hotelId, date: day } }),
  ]);

  // Who is in each room tonight (for hints on room cards).
  const tonightReservations = await db.reservation.findMany({
    where: {
      hotelId,
      checkIn: { lte: day },
      checkOut: { gt: day },
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    include: { guest: { select: { fullName: true } }, room: { select: { id: true } } },
  });
  const guestByRoom = new Map<string, string>();
  for (const r of tonightReservations) {
    if (!guestByRoom.has(r.room.id)) guestByRoom.set(r.room.id, r.guest.fullName);
  }

  const rooms = roomsRaw.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    status: r.status as never as import("@/lib/constants").RoomStatus,
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    guestTonight: guestByRoom.get(r.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t.rooms.title} description={t.rooms.description} />

      {/* Room type summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {roomTypes.map((type) => {
          const availRow = availabilityToday.find((a) => a.roomTypeId === type.id);
          const available = availRow ? availRow.availableRooms : type.rooms.length;
          const occupancy = type.rooms.length === 0 ? 0 : 1 - available / type.rooms.length;
          return (
            <Card key={type.id} className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <h2 className="text-base font-semibold">{type.name}</h2>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums whitespace-nowrap">
                    {t.rooms.fullBadge(formatPercent(occupancy))}
                  </span>
                </div>
                {type.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{type.description}</p>
                ) : null}
                <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-center">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.rooms.terms.count}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">{type.rooms.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.rooms.terms.capacity}</dt>
                    <dd className="mt-0.5 flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
                      <Users className="size-4 text-muted-foreground" />
                      {type.capacity}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.rooms.terms.from}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatMoney(type.basePrice)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {t.rooms.availableForDate(available, type.rooms.length, toISODate(day).slice(5))}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* All rooms by floor */}
      <section>
        <h2 className="mb-3 text-base font-semibold">{t.rooms.allRooms}</h2>
        <RoomsGrid rooms={rooms} />
      </section>
    </div>
  );
}
