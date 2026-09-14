import Link from "next/link";
import { AlertCircle, BedDouble, CalendarCheck2, CalendarX2, CheckCircle2, CircleDollarSign, Sparkles } from "lucide-react";
import { db, getCurrentHotelId } from "@/lib/db";
import { getChannelHealth, getDashboardStats, getRecentReservations } from "@/lib/stats";
import { toReservationVM, type GuestVM, type RatePlanVM, type RoomVM } from "@/lib/types";
import { todayInTimeZone, formatMediumDate } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/utils";
import { getCurrentUser } from "@/lib/tenant";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { RecentReservationsTable } from "@/components/dashboard/recent-reservations-table";
import { ChannelHealthCard } from "@/components/channels/channel-health-card";
import { SyncAllButton } from "@/components/channels/sync-all-button";
import { ReservationStatusBadge, ChannelLabel } from "@/components/shared/status-badge";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";
import { requireSectionAccess } from "@/server/guards";
import { resolveHotelPermissions } from "@/lib/access";
import { BookingChart, OccupancyChart, OccupancyForecast } from "@/components/dashboard/overview-charts";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSectionAccess("OVERVIEW");
  const hotelId = await getCurrentHotelId();
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const day = todayInTimeZone(hotel.timezone);
  const [user, stats, recent, channelHealth, roomTypes, roomsRaw, ratePlansRaw, guestsRaw] = await Promise.all([
    getCurrentUser(), getDashboardStats(hotelId, day, hotel.timezone), getRecentReservations(hotelId, 20),
    PRODUCT_AVAILABILITY.channels ? getChannelHealth(hotelId) : Promise.resolve([]),
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" } }),
    db.room.findMany({ where: { hotelId }, include: { roomType: { select: { name: true } } }, orderBy: { number: "asc" } }),
    db.ratePlan.findMany({ where: { hotelId }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
  ]);
  const rooms: RoomVM[] = roomsRaw.map((room) => ({ id: room.id, number: room.number, floor: room.floor, status: room.status as RoomVM["status"], roomTypeId: room.roomTypeId, roomTypeName: room.roomType.name, guestTonight: null }));
  const ratePlans: RatePlanVM[] = ratePlansRaw.map((plan) => ({ id: plan.id, name: plan.name, roomTypeId: plan.roomTypeId, roomTypeName: roomTypes.find((type) => type.id === plan.roomTypeId)?.name ?? "", basePrice: Number(plan.basePrice), currency: plan.currency, refundable: plan.refundable, breakfastIncluded: plan.breakfastIncluded }));
  const guests: GuestVM[] = guestsRaw.map((guest) => ({ id: guest.id, fullName: guest.fullName, email: guest.email, phone: guest.phone, country: guest.country, notes: guest.notes }));
  const permissions = resolveHotelPermissions(user ?? {});
  const waitingArrivals = stats.arrivalsToday.filter((reservation) => !["CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(reservation.status)).length;
  const attentionItems = [
    waitingArrivals ? { label: `${waitingArrivals} гостей ожидают заселения сегодня`, href: "/dashboard/reservations" } : null,
    stats.roomsCleaning ? { label: `${stats.roomsCleaning} ${roomWord(stats.roomsCleaning)} сейчас на уборке`, href: "/dashboard/rooms" } : null,
    stats.roomsUnavailable ? { label: `${stats.roomsUnavailable} ${roomWord(stats.roomsUnavailable)} недоступно из-за обслуживания`, href: "/dashboard/rooms" } : null,
  ].filter((item): item is { label: string; href: string } => Boolean(item));

  return <div className="space-y-5">
    <PageHeader title={user?.firstName ? `${greeting(hotel.timezone)}, ${user.firstName}` : greeting(hotel.timezone)} description={`${hotel.name} · ${formatMediumDate(day)}`}>
      {PRODUCT_AVAILABILITY.channels ? <SyncAllButton /> : null}
    </PageHeader>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Основные показатели">
      <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5">
        <div className="relative grid size-16 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${Math.round(stats.occupancyTonight * 360)}deg, var(--secondary) 0deg)` }}>
          <div className="grid size-12 place-items-center rounded-full bg-card text-sm font-semibold tabular-nums">{formatPercent(stats.occupancyTonight)}</div>
        </div>
        <Metric label="Загрузка сегодня" value={`${stats.occupiedTonight} из ${stats.totalRooms}`} sub="занятых номеров" />
      </CardContent></Card>
      <MetricCard icon={CalendarCheck2} label="Активные брони" value={String(stats.activeReservations)} sub={`${stats.arrivalsToday.length} заездов сегодня`} />
      <MetricCard icon={CircleDollarSign} label="Выручка с начала месяца" value={formatMoney(stats.revenueMonthToDate)} sub="по действующим и завершённым броням" />
      <MetricCard icon={BedDouble} label="Свободно сегодня" value={String(stats.availableRoomsTonight)} sub={`${stats.inHouseGuests} гостей проживают`} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr_0.72fr]">
      <Card className="shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Сегодня требует внимания</h2><p className="text-xs text-muted-foreground">Только фактические операционные события</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{attentionItems.length}</span></div>
        <CardContent className="p-0">
          {attentionItems.length ? attentionItems.map((item) => <Link key={item.label} href={item.href} className="flex items-center gap-3 border-b px-5 py-3.5 text-sm last:border-b-0 hover:bg-secondary/40"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary"><AlertCircle className="size-4 text-primary" /></span><span className="flex-1">{item.label}</span><span className="text-muted-foreground">→</span></Link>) : <div className="flex min-h-36 items-center gap-3 px-5 text-sm text-muted-foreground"><CheckCircle2 className="size-5 text-primary" /> На сегодня срочных задач нет.</div>}
        </CardContent>
      </Card>
      <TodayList title="Заезды сегодня" href="/dashboard/reservations" icon={CalendarCheck2} rows={stats.arrivalsToday} empty="Сегодня заездов нет" />
      <TodayList title="Выезды сегодня" href="/dashboard/reservations" icon={CalendarX2} rows={stats.departuresToday} empty="Сегодня выездов нет" />
    </section>

    <section className="grid gap-4 xl:grid-cols-2"><OccupancyChart points={stats.occupancyTrend} /><BookingChart points={stats.bookingTrend} /></section>
    <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]"><OccupancyForecast points={stats.occupancyForecast} /><QuickActions rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotel.currency} canCreateReservation={permissions.includes("RESERVATIONS")} canOpenCalendar={permissions.includes("CALENDAR")} canOpenGuests={permissions.includes("GUESTS")} canOpenRooms={permissions.includes("ROOMS")} /></section>

    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4"><div><h2 className="font-semibold">Последние бронирования</h2><p className="text-sm text-muted-foreground">Фактические записи текущего отеля</p></div><Sparkles className="size-4 text-muted-foreground" /></header>
      {recent.length ? <RecentReservationsTable reservations={recent.map(toReservationVM)} rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotel.currency} /> : <EmptyState icon={CalendarCheck2} title="Бронирований пока нет" description="Создайте первую бронь — она сразу появится в обзоре." className="py-10" />}
    </section>
    {PRODUCT_AVAILABILITY.channels ? <ChannelHealthCard rows={channelHealth} /> : null}
  </div>;
}

function MetricCard({ icon: Icon, label, value, sub }: { icon: typeof BedDouble; label: string; value: string; sub: string }) {
  return <Card className="shadow-sm"><CardContent className="flex items-start justify-between gap-3 p-5"><Metric label={label} value={value} sub={sub} /><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-4" /></span></CardContent></Card>;
}
function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sub}</p></div>;
}
function TodayList({ title, href, icon: Icon, rows, empty }: { title: string; href: string; icon: typeof CalendarCheck2; rows: Awaited<ReturnType<typeof getDashboardStats>>["arrivalsToday"]; empty: string }) {
  return <Card className="overflow-hidden shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-primary" /> {title}</h2><Link href={href} className="text-xs font-medium text-primary hover:underline">Все →</Link></div>{rows.length ? <Table><TableBody>{rows.slice(0, 4).map((reservation) => <TableRow key={reservation.id}><TableCell className="font-medium">{reservation.guest.fullName}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">№ {reservation.room.number} · {reservation.roomType.name}</span></TableCell><TableCell className="hidden sm:table-cell"><ChannelLabel channel={reservation.sourceChannel} /></TableCell><TableCell className="text-right"><ReservationStatusBadge status={reservation.status as never} /></TableCell></TableRow>)}</TableBody></Table> : <div className="flex min-h-36 items-center justify-center px-5 text-sm text-muted-foreground">{empty}</div>}</Card>;
}
function greeting(timeZone: string): string { const hour = Number(new Intl.DateTimeFormat("ru-RU", { timeZone, hour: "2-digit", hour12: false }).format(new Date())); if (hour < 12) return "Доброе утро"; if (hour < 18) return "Добрый день"; return "Добрый вечер"; }
function roomWord(value: number): string { return value === 1 ? "номер" : value < 5 ? "номера" : "номеров"; }
