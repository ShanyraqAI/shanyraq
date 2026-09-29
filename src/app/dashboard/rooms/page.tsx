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
import { getRequestLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ room?: string | string[] }> }) {
  await requireSectionAccess("ROOMS");
  const hotelId = await getCurrentHotelId();
  const locale = await getRequestLocale();
  const query = await searchParams;
  const highlightRoomId = typeof query.room === "string" ? query.room : undefined;
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
  const readyRooms = rooms.filter((room) => room.status === "AVAILABLE" && !room.guestTonight).length;
  const readiness = rooms.length ? Math.round(readyRooms / rooms.length * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="hidden sm:block"><PageHeader title={locale === "kk" ? "Пәтерлер" : "Квартиры"} description={locale === "kk" ? "Орналастыру қорының дайындығы мен ағымдағы күйі." : t.rooms.description}>
        <RoomsGrid rooms={[]} roomTypes={roomTypes.map((type) => type.name)} addButtonOnly locale={locale} />
      </PageHeader></div>
      <div className="space-y-3 sm:hidden"><header><h1 className="sh-mobile-title">{locale === "kk" ? "Пәтерлер" : "Квартиры"}</h1><p className="sh-mobile-eyebrow">{rooms.length} {locale === "kk" ? "пәтер" : "квартир"} · {readyRooms} {locale === "kk" ? "дайын" : "готовы"}</p></header><div className="sh-mobile-card p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold text-[#929991]">{locale === "kk" ? "Бүгінгі дайындық" : "Готовность сегодня"}</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-[#25322c]">{readyRooms} / {rooms.length}</p></div><b className="text-sm text-[#07866b]">{readiness}%</b></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8ebe4]"><div className="h-full rounded-full bg-[#07866b]" style={{ width: `${Math.max(4, readiness)}%` }} /></div></div><div className="flex gap-1.5 overflow-x-auto pb-1"><span className="sh-mobile-chip bg-[#07866b] text-white">{locale === "kk" ? "Барлығы" : "Все"} {rooms.length}</span><span className="sh-mobile-chip">{locale === "kk" ? "Дайын" : "Готовы"} {readyRooms}</span><span className="sh-mobile-chip">{locale === "kk" ? "Жинау" : "Уборка"} {rooms.filter((room) => room.status === "CLEANING").length}</span><span className="sh-mobile-chip">{locale === "kk" ? "Жөндеу" : "Ремонт"} {rooms.filter((room) => ["MAINTENANCE", "OUT_OF_ORDER"].includes(room.status)).length}</span></div></div>

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
        <h2 className="mb-3 hidden text-base font-semibold sm:block">{locale === "kk" ? "Барлық пәтер" : "Все квартиры"}</h2>
        <RoomsGrid rooms={rooms} roomTypes={roomTypes.map((type) => type.name)} locale={locale} highlightRoomId={highlightRoomId} />
      </section>
    </div>
  );
}
