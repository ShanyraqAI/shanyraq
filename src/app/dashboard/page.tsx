import Link from "next/link";
import { AlertCircle, BedDouble, CalendarCheck2, CalendarX2, CheckCircle2, Sparkles, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { db, getCurrentHotelId } from "@/lib/db";
import { getChannelHealth, getDashboardStats, getRecentReservations } from "@/lib/stats";
import { toReservationVM, type GuestVM, type RatePlanVM, type RoomVM } from "@/lib/types";
import { todayInTimeZone, formatMediumDate, formatShortDate } from "@/lib/dates";
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
import { DesktopOnly } from "@/components/dashboard/desktop-only";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { getRequestLocale } from "@/lib/locale-server";
import { mobileCopy, type AppLocale } from "@/lib/locale";
import { MobileOverview } from "@/components/dashboard/mobile-overview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSectionAccess("OVERVIEW");
  const hotelId = await getCurrentHotelId();
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const locale = await getRequestLocale(hotel.language);
  const mobile = mobileCopy[locale];
  const day = todayInTimeZone(hotel.timezone);
  const [user, stats, recent, channelHealth, roomTypes, roomsRaw, ratePlansRaw, guestsRaw, depositFollowups, activeForConflicts] = await Promise.all([
    getCurrentUser(), getDashboardStats(hotelId, day, hotel.timezone, hotel.currency), getRecentReservations(hotelId, 20),
    PRODUCT_AVAILABILITY.channels ? getChannelHealth(hotelId) : Promise.resolve([]),
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" } }),
    db.room.findMany({ where: { hotelId }, include: { roomType: { select: { name: true } } }, orderBy: { number: "asc" } }),
    db.ratePlan.findMany({ where: { hotelId }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
    db.reservation.findMany({ where: { hotelId, status: "CHECKED_OUT", depositAmount: { gt: 0 }, depositCollectedAt: { not: null }, depositReturnedAt: null }, include: { room: { select: { number: true } }, guest: { select: { fullName: true } } }, orderBy: { updatedAt: "asc" }, take: 10 }),
    db.reservation.findMany({ where: { hotelId, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }, checkOut: { gt: day } }, select: { id: true, roomId: true, checkIn: true, checkOut: true, guest: { select: { fullName: true } }, room: { select: { number: true } } }, orderBy: { checkIn: "asc" }, take: 150 }),
  ]);
  const rooms: RoomVM[] = roomsRaw.map((room) => ({ id: room.id, number: room.number, floor: room.floor, status: room.status as RoomVM["status"], roomTypeId: room.roomTypeId, roomTypeName: room.roomType.name, guestTonight: null }));
  const ratePlans: RatePlanVM[] = ratePlansRaw.map((plan) => ({ id: plan.id, sequenceNumber: plan.sequenceNumber, name: plan.name, roomTypeId: plan.roomTypeId, roomTypeName: roomTypes.find((type) => type.id === plan.roomTypeId)?.name ?? "", basePrice: Number(plan.basePrice), currency: plan.currency, refundable: plan.refundable, breakfastIncluded: plan.breakfastIncluded }));
  const guests: GuestVM[] = guestsRaw.map((guest) => ({ id: guest.id, sequenceNumber: guest.sequenceNumber, fullName: guest.fullName, email: guest.email, phone: guest.phone, country: guest.country, notes: guest.notes }));
  const permissions = resolveHotelPermissions(user ?? {});
  // Month-to-date nights, e.g. "1–3 окт"; the Reports page uses the same period.
  const revenuePeriodLabel = day.getUTCDate() === 1 ? formatShortDate(day) : `1–${formatShortDate(day)}`;
  const waitingArrivals = stats.arrivalsToday.filter((reservation) => !["CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(reservation.status)).length;
  const unusualArrivals = stats.arrivalsToday
    .filter((reservation) => !["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(reservation.status) && (reservation.checkInTime < "14:00" || reservation.checkInTime > "20:00"))
    .map((reservation) => ({ label: `${locale === "kk" ? (reservation.checkInTime < "14:00" ? "Ерте келу" : "Кеш келу") : (reservation.checkInTime < "14:00" ? "Ранний заезд" : "Поздний заезд")} · ${reservation.checkInTime}`, room: reservation.room.number, guest: reservation.guest.fullName, href: `/dashboard/reservations/${reservation.id}` }));
  const unusualDepartures = stats.departuresToday
    .filter((reservation) => !["CANCELLED", "NO_SHOW"].includes(reservation.status) && reservation.checkOutTime !== "12:00")
    .map((reservation) => ({ label: `${locale === "kk" ? (reservation.checkOutTime < "12:00" ? "Ерте кету" : "Кеш кету") : (reservation.checkOutTime < "12:00" ? "Ранний выезд" : "Поздний выезд")} · ${reservation.checkOutTime}`, room: reservation.room.number, guest: reservation.guest.fullName, href: `/dashboard/reservations/${reservation.id}` }));
  const cleaningItems = roomsRaw.filter((room) => room.status === "CLEANING").map((room) => ({ label: locale === "kk" ? "Жинау керек" : "Требуется уборка", room: room.number, guest: "", href: `/dashboard/rooms?room=${room.id}` }));
  const maintenanceItems = roomsRaw.filter((room) => room.status === "MAINTENANCE" || room.status === "OUT_OF_ORDER").map((room) => ({ label: locale === "kk" ? "Қызмет көрсету керек" : "Требуется обслуживание", room: room.number, guest: "", href: `/dashboard/rooms?room=${room.id}` }));
  const conflictItems: typeof unusualArrivals = [];
  for (let index = 0; index < activeForConflicts.length; index += 1) {
    const current = activeForConflicts[index];
    const other = activeForConflicts.slice(index + 1).find((row) => row.roomId === current.roomId && row.checkIn < current.checkOut && row.checkOut > current.checkIn);
    if (other) conflictItems.push({ label: locale === "kk" ? "Бронь күндері қабаттасуы мүмкін" : "Возможное пересечение броней", room: current.room.number, guest: `${current.guest.fullName} / ${other.guest.fullName}`, href: `/dashboard/reservations/${current.id}` });
  }
  const depositItems = depositFollowups.map((row) => ({ label: locale === "kk" ? "Қонақ кеткен соң депозит қайтарылмады" : "Депозит не возвращён после выезда", room: row.room.number, guest: row.guest.fullName, href: `/dashboard/reservations/${row.id}` }));
  const attentionItems = [
    ...depositItems,
    ...conflictItems,
    ...unusualDepartures,
    ...unusualArrivals,
    ...maintenanceItems,
    ...cleaningItems,
    ...(waitingArrivals ? [{ label: locale === "kk" ? `${waitingArrivals} қонақ қоныстануды күтуде` : `${waitingArrivals} ожидают заселения`, room: mobile.dashboard.arrivals, guest: mobile.dashboard.today, href: "/dashboard/reservations?period=arrivals" }] : []),
  ].slice(0, 12);

  return <div className="space-y-5">
    <MobileOverview
      locale={locale}
      dateLabel={formatMediumDate(day)}
      revenue={stats.revenueMonthToDate}
      revenueNights={stats.revenueNightsMonthToDate}
      revenuePeriodLabel={revenuePeriodLabel}
      occupancyPercent={stats.occupancyTonight ? Math.round(stats.occupancyTonight * 100) : 0}
      activeReservations={stats.activeReservations}
      arrivals={stats.arrivalsToday.map((item) => ({ id: item.id, guest: item.guest.fullName, room: item.room.number, time: item.checkInTime }))}
      departures={stats.departuresToday.map((item) => ({ id: item.id, guest: item.guest.fullName, room: item.room.number, time: item.checkOutTime }))}
      cleaningCount={stats.roomsCleaning}
      attention={attentionItems}
      recent={recent.slice(0, 2).map((item) => ({ id: item.id, guest: item.guest.fullName, room: item.room.number, dateLabel: formatMediumDate(item.checkIn), day: new Date(item.checkIn).getUTCDate() }))}
      canCreateReservation={permissions.includes("RESERVATIONS")}
    />
    <DesktopOnly><div className="space-y-5"><PageHeader title={user?.firstName ? `${greeting(hotel.timezone)}, ${user.firstName}` : greeting(hotel.timezone)} description={`${hotel.name} · ${formatMediumDate(day)}`}>
      {PRODUCT_AVAILABILITY.channels ? <SyncAllButton /> : null}
    </PageHeader>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Основные показатели">
      <MetricCard
        label="Загрузка сегодня"
        value={`${stats.occupiedTonight} из ${stats.totalRooms}`}
        sub="занятых номеров"
        visual={<OccupancyRing value={stats.occupancyTonight} />}
      />
      <MetricCard
        label="Активные брони"
        value={String(stats.activeReservations)}
        sub={`${stats.arrivalsToday.length} заездов сегодня`}
        visual={<MetricVisual icon={CalendarCheck2} caption={`${stats.activeReservationsByStatus.CONFIRMED} подтвержд.`} />}
      />
      <MetricCard
        label="Выручка с начала месяца"
        value={formatMoney(stats.revenueMonthToDate)}
        sub={`${revenuePeriodLabel} · ${stats.revenueNightsMonthToDate} ноч. · как в отчётах`}
        visual={<MetricVisual icon={WalletCards} caption="за месяц" />}
      />
      <MetricCard
        label="Свободно сегодня"
        value={`${stats.availableRoomsTonight} из ${stats.totalRooms}`}
        sub={`${stats.inHouseGuests} гостей проживают`}
        visual={<MetricVisual icon={BedDouble} caption={`${stats.totalRooms ? Math.round(stats.availableRoomsTonight / stats.totalRooms * 100) : 0}% свободно`} />}
      />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr_0.72fr]">
      <Card className="shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Сегодня требует внимания</h2><p className="text-xs text-muted-foreground">Только фактические операционные события</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{attentionItems.length}</span></div>
        <CardContent className="p-0">
          {attentionItems.length ? attentionItems.map((item) => <Link key={item.label} href={item.href} className="flex items-center gap-3 border-b px-5 py-3.5 text-sm last:border-b-0 hover:bg-secondary/40"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary"><AlertCircle className="size-4 text-primary" /></span><span className="flex-1">{item.room} · {item.label}{item.guest ? ` · ${item.guest}` : ""}</span><span className="text-muted-foreground">→</span></Link>) : <div className="flex min-h-36 items-center gap-3 px-5 text-sm text-muted-foreground"><CheckCircle2 className="size-5 text-primary" /> На сегодня срочных задач нет.</div>}
        </CardContent>
      </Card>
      <TodayList title="Заезды сегодня" href="/dashboard/reservations" icon={CalendarCheck2} rows={stats.arrivalsToday} empty="Сегодня заездов нет" />
      <TodayList title="Выезды сегодня" href="/dashboard/reservations" icon={CalendarX2} rows={stats.departuresToday} empty="Сегодня выездов нет" />
    </section>

    <div className="flex flex-col gap-5">
      <section className="order-2 grid gap-4 md:order-1 xl:grid-cols-2"><OccupancyChart points={stats.occupancyTrend} /><BookingChart points={stats.bookingTrend} /></section>
      <section className="order-1 grid gap-4 md:order-2 xl:grid-cols-[1.35fr_0.65fr]"><OccupancyForecast points={stats.occupancyForecast} /><div className="order-first xl:order-none"><QuickActions rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotel.currency} canCreateReservation={permissions.includes("RESERVATIONS")} canOpenCalendar={permissions.includes("CALENDAR")} canOpenGuests={permissions.includes("GUESTS")} canOpenRooms={permissions.includes("ROOMS")} /></div></section>
    </div>

    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4"><div><h2 className="font-semibold">Последние бронирования</h2><p className="text-sm text-muted-foreground">Фактические записи текущего отеля</p></div><Sparkles className="size-4 text-muted-foreground" /></header>
      {recent.length ? <RecentReservationsTable reservations={recent.map(toReservationVM)} rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotel.currency} /> : <EmptyState icon={CalendarCheck2} title="Бронирований пока нет" description="Создайте первую бронь — она сразу появится в обзоре." className="py-10" />}
    </section>
    {PRODUCT_AVAILABILITY.channels ? <ChannelHealthCard rows={channelHealth} /> : null}</div></DesktopOnly>
  </div>;
}

function MetricCard({ label, value, sub, visual }: { label: string; value: string; sub: string; visual: ReactNode }) {
  return <Card className="group relative overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-secondary/25 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md">
    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/75 via-chart-2/55 to-transparent" />
    <CardContent className="flex min-h-36 items-center justify-between gap-3 p-5">
      <Metric label={label} value={value} sub={sub} />
      <div className="flex min-w-[76px] shrink-0 justify-center">{visual}</div>
    </CardContent>
  </Card>;
}
function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1.5 whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1.5 line-clamp-2 text-xs leading-4 text-muted-foreground">{sub}</p></div>;
}
function OccupancyRing({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  return <div className="relative grid size-[76px] place-items-center" aria-label={`Загрузка ${percent}%`}>
    <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
      <circle cx="21" cy="21" r="17" pathLength="100" fill="none" stroke="var(--secondary)" strokeWidth="4" />
      <circle cx="21" cy="21" r="17" pathLength="100" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${percent} ${100 - percent}`} />
    </svg>
    <span className="absolute text-sm font-semibold tabular-nums text-foreground">{formatPercent(value)}</span>
  </div>;
}
function MetricVisual({ icon: Icon, caption }: { icon: typeof CalendarCheck2; caption: string }) {
  return <span className="grid size-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary ring-1 ring-primary/10" aria-label={caption} title={caption}><Icon className="size-5" aria-hidden="true" /></span>;
}
function TodayList({ title, href, icon: Icon, rows, empty }: { title: string; href: string; icon: typeof CalendarCheck2; rows: Awaited<ReturnType<typeof getDashboardStats>>["arrivalsToday"]; empty: string }) {
  return <Card className="overflow-hidden shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-primary" /> {title}</h2><Link href={href} className="text-xs font-medium text-primary hover:underline">Все →</Link></div>{rows.length ? <Table><TableBody>{rows.slice(0, 4).map((reservation) => <TableRow key={reservation.id}><TableCell className="font-medium">{reservation.guest.fullName}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">№ {reservation.room.number} · {reservation.roomType.name}</span></TableCell><TableCell className="hidden 2xl:table-cell"><ChannelLabel channel={reservation.sourceChannel} /></TableCell><TableCell className="hidden text-right 2xl:table-cell"><ReservationStatusBadge status={reservation.status as never} /></TableCell></TableRow>)}</TableBody></Table> : <div className="flex min-h-36 items-center justify-center px-5 text-sm text-muted-foreground">{empty}</div>}</Card>;
}
function greeting(timeZone: string, locale: AppLocale = "ru"): string { const hour = Number(new Intl.DateTimeFormat("ru-RU", { timeZone, hour: "2-digit", hour12: false }).format(new Date())); if (locale === "kk") return hour < 12 ? "Қайырлы таң" : hour < 18 ? "Қайырлы күн" : "Қайырлы кеш"; if (hour < 12) return "Доброе утро"; if (hour < 18) return "Добрый день"; return "Добрый вечер"; }
