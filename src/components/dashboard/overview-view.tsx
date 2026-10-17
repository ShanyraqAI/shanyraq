"use client";

import Link from "next/link";
import { AlertCircle, BedDouble, CalendarCheck2, CalendarX2, CheckCircle2, Sparkles, WalletCards } from "lucide-react";
import { memo, type ReactNode } from "react";

import { formatMediumDate } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { RecentReservationsTable } from "@/components/dashboard/recent-reservations-table";
import { ChannelHealthCard } from "@/components/channels/channel-health-card";
import { SyncAllButton } from "@/components/channels/sync-all-button";
import { ReservationStatusBadge, ChannelLabel } from "@/components/shared/status-badge";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";
import { BookingChart, OccupancyChart, OccupancyForecast } from "@/components/dashboard/overview-charts";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DesktopOnly } from "@/components/dashboard/desktop-only";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

import { MobileOverview } from "@/components/dashboard/mobile-overview";

import type { OverviewContext, OverviewCore, OverviewData, TodayRow } from "@/lib/dashboard/overview-types";

export const OverviewView = memo(function OverviewView({ context, core, attention: attentionData, recent: recentData, channels: channelData }: {
  context: OverviewContext; core: OverviewCore; attention?: OverviewData["attention"]; recent?: OverviewData["recent"]; channels?: OverviewData["channels"];
}) {
  const { locale, permissions } = context;
  const day = new Date(context.day);
  const hotel = { name: core.hotelName, currency: core.currency };
  const user = { firstName: core.userFirstName };
  const canViewReservations = permissions.includes("RESERVATIONS");
  const stats = {
    ...core.stats,
    occupancyTrend: core.stats.occupancyTrend.map((row) => ({ ...row, date: new Date(row.date) })),
    bookingTrend: core.stats.bookingTrend.map((row) => ({ ...row, date: new Date(row.date) })),
    occupancyForecast: core.stats.occupancyForecast.map((row) => ({ ...row, date: new Date(row.date) })),
  };
  const revenuePeriodLabel = core.revenuePeriodLabel;
  const attentionItems = [...(attentionData ?? []), ...core.attention].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).slice(0, 12);
  const recent = recentData ?? [];
  const channelHealth = (channelData ?? []).map((row) => ({ ...row, lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt) : null }));
  return <div className="space-y-5" data-overview-content>
    <MobileOverview
      locale={locale}
      dateLabel={formatMediumDate(day)}
      revenue={stats.revenueMonthToDate}
      revenueNights={stats.revenueNightsMonthToDate}
      revenuePeriodLabel={revenuePeriodLabel}
      occupancyPercent={stats.occupancyTonight ? Math.round(stats.occupancyTonight * 100) : 0}
      occupiedToday={stats.occupiedTonight}
      totalRooms={stats.totalRooms}
      revenueToday={stats.revenueToday}
      arrivals={stats.arrivalsToday.map((item) => ({ id: item.id, guest: item.guest.fullName, room: item.room.number, time: item.checkInTime }))}
      departures={stats.departuresToday.map((item) => ({ id: item.id, guest: item.guest.fullName, room: item.room.number, time: item.checkOutTime }))}
      cleaningCount={stats.roomsCleaning}
      attention={attentionItems}
      recent={recent.slice(0, 2).map((item) => ({ id: item.id, guest: item.guestName, room: item.roomNumber, dateLabel: formatMediumDate(new Date(item.checkIn)), day: new Date(item.checkIn).getUTCDate() }))}
      attentionKnown={attentionData !== undefined}
      recentKnown={recentData !== undefined}
      canCreateReservation={canViewReservations}
    />
    <DesktopOnly><div className="space-y-5"><PageHeader title={user?.firstName ? `${core.greeting}, ${user.firstName}` : core.greeting} description={`${hotel.name} · ${formatMediumDate(day)}`}>
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
        <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Сегодня требует внимания</h2><p className="text-xs text-muted-foreground">Только фактические операционные события</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{attentionData === undefined ? "—" : attentionItems.length}</span></div>
        <CardContent className="p-0">
          {attentionData === undefined ? <p className="p-5 text-sm text-muted-foreground">Данные внимания ещё не загружены.</p> : attentionItems.length ? attentionItems.map((item) => <Link key={item.label} href={item.href} className="flex items-center gap-3 border-b px-5 py-3.5 text-sm last:border-b-0 hover:bg-secondary/40"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary"><AlertCircle className="size-4 text-primary" /></span><span className="flex-1">{item.room} · {item.label}{item.guest ? ` · ${item.guest}` : ""}</span><span className="text-muted-foreground">→</span></Link>) : <div className="flex min-h-36 items-center gap-3 px-5 text-sm text-muted-foreground"><CheckCircle2 className="size-5 text-primary" /> На сегодня срочных задач нет.</div>}
        </CardContent>
      </Card>
      <TodayList title="Заезды сегодня" href="/dashboard/reservations" icon={CalendarCheck2} rows={stats.arrivalsToday} empty="Сегодня заездов нет" />
      <TodayList title="Выезды сегодня" href="/dashboard/reservations" icon={CalendarX2} rows={stats.departuresToday} empty="Сегодня выездов нет" />
    </section>

    <div className="flex flex-col gap-5">
      <section className="order-2 grid gap-4 md:order-1 xl:grid-cols-2"><OccupancyChart points={stats.occupancyTrend} /><BookingChart points={stats.bookingTrend} /></section>
      <section className="order-1 grid gap-4 md:order-2 xl:grid-cols-[1.35fr_0.65fr]"><OccupancyForecast points={stats.occupancyForecast} /><div className="order-first xl:order-none"><QuickActions canCreateReservation={canViewReservations} canOpenCalendar={permissions.includes("CALENDAR")} canOpenGuests={permissions.includes("GUESTS")} canOpenRooms={permissions.includes("ROOMS")} /></div></section>
    </div>

    {canViewReservations ? <section className="rounded-xl border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4"><div><h2 className="font-semibold">Последние бронирования</h2><p className="text-sm text-muted-foreground">Фактические записи текущего отеля</p></div><Sparkles className="size-4 text-muted-foreground" /></header>
      {recentData === undefined ? <p className="text-sm text-muted-foreground">Список ещё не загружен.</p> : recent.length ? <RecentReservationsTable reservations={recent} navigateOnSelect /> : <EmptyState icon={CalendarCheck2} title="Бронирований пока нет" description="Создайте первую бронь — она сразу появится в обзоре." className="py-10" />}
    </section> : null}
    {PRODUCT_AVAILABILITY.channels ? channelData === undefined ? <p className="text-sm text-muted-foreground">Статус каналов ещё не загружен.</p> : <ChannelHealthCard rows={channelHealth} /> : null}</div></DesktopOnly>
  </div>;
});

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
function TodayList({ title, href, icon: Icon, rows, empty }: { title: string; href: string; icon: typeof CalendarCheck2; rows: TodayRow[]; empty: string }) {
  return <Card className="overflow-hidden shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-primary" /> {title}</h2><Link href={href} className="text-xs font-medium text-primary hover:underline">Все →</Link></div>{rows.length ? <Table><TableBody>{rows.slice(0, 4).map((reservation) => <TableRow key={reservation.id}><TableCell className="font-medium">{reservation.guest.fullName}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">№ {reservation.room.number} · {reservation.roomType.name}</span></TableCell><TableCell className="hidden 2xl:table-cell"><ChannelLabel channel={reservation.sourceChannel} /></TableCell><TableCell className="hidden text-right 2xl:table-cell"><ReservationStatusBadge status={reservation.status as never} /></TableCell></TableRow>)}</TableBody></Table> : <div className="flex min-h-36 items-center justify-center px-5 text-sm text-muted-foreground">{empty}</div>}</Card>;
}
