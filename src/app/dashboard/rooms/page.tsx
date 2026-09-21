import { BedDouble, Users } from "lucide-react";
import { db, getCurrentHotelId } from "@/lib/db";
import { formatISOCompactDate, today, toISODate } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { RoomsGrid } from "@/components/rooms/rooms-grid";
import { t } from "@/lib/i18n";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  await requireSectionAccess("ROOMS");
  const hotelId = await getCurrentHotelId();
  const day = today();

  const [roomTypes, roomsRaw] = await Promise.all([
    db.roomType.findMany({
      where: { hotelId },
      include: { rooms: { orderBy: { number: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    db.room.findMany({
      where: { hotelId },
      include: { roomType: { select: { name: true, capacity: true, basePrice: true } } },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
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
    capacity: r.roomType.capacity,
    basePrice: Number(r.roomType.basePrice),
    guestTonight: guestByRoom.get(r.id) ?? null,
  }));
  const populatedRoomTypes = roomTypes.filter((type) => type.rooms.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t.rooms.title} description={t.rooms.description}>
        <RoomsGrid rooms={[]} roomTypes={roomTypes.map((type) => type.name)} addButtonOnly />
      </PageHeader>

      {/* Room type summary cards */}
      <div className="hidden grid-cols-1 gap-4 sm:grid md:grid-cols-3">
        {populatedRoomTypes.map((type) => {
          const available = type.rooms.filter((room) => room.status === "AVAILABLE").length;
          const occupancy = type.rooms.length === 0 ? 0 : 1 - available / type.rooms.length;
          return (
            <Card key={type.id} className="group relative h-full overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.045] shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-chart-2/55 to-transparent" />
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between">
                  <h2 className="flex min-w-0 items-center gap-2.5 text-base font-semibold"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10"><BedDouble className="size-4" /></span><span className="truncate">{type.name}</span></h2>
                  <span className="whitespace-nowrap rounded-full border border-primary/10 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-primary">
                    {t.rooms.fullBadge(formatPercent(occupancy))}
                  </span>
                </div>
                {type.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{type.description}</p>
                ) : null}
                <dl className="mt-4 grid grid-cols-[0.8fr_1fr_1.25fr] items-start divide-x divide-primary/10 rounded-xl border border-primary/10 bg-card/70 py-3 text-center shadow-xs">
                  <div className="min-w-0 px-1">
                    <dt className="h-8 text-[10px] font-medium uppercase leading-4 tracking-wide text-muted-foreground">{t.rooms.terms.count}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">{type.rooms.length}</dd>
                  </div>
                  <div className="min-w-0 px-1">
                    <dt className="h-8 text-[10px] font-medium uppercase leading-4 tracking-wide text-muted-foreground">{t.rooms.terms.capacity}</dt>
                    <dd className="mt-1 flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
                      <Users className="size-4 text-muted-foreground" />
                      {type.capacity}
                    </dd>
                  </div>
                  <div className="min-w-0 px-1">
                    <dt className="h-8 text-[10px] font-medium uppercase leading-4 tracking-wide text-muted-foreground">{t.rooms.terms.from}</dt>
                    <dd className="mt-1 whitespace-nowrap text-base font-semibold tabular-nums">{formatMoney(Number(type.basePrice))}</dd>
                  </div>
                </dl>
                <p className="mt-auto pt-3 text-center text-xs text-muted-foreground">
                  {t.rooms.availableForDate(available, type.rooms.length, formatISOCompactDate(toISODate(day)))}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* All rooms by floor */}
      <section>
        <h2 className="mb-3 text-base font-semibold">{t.rooms.allRooms}</h2>
        <RoomsGrid rooms={rooms} roomTypes={roomTypes.map((type) => type.name)} />
      </section>
    </div>
  );
}
