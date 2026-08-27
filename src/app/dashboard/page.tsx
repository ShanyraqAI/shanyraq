import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  CalendarCheck2,
  CalendarX2,
  Percent,
  ReceiptText,
} from "lucide-react";
import { db, getCurrentHotelId } from "@/lib/db";
import { getChannelHealth, getDashboardStats, getRecentReservations } from "@/lib/stats";
import { toReservationVM, type GuestVM, type RatePlanVM, type RoomVM } from "@/lib/types";
import { today, formatMediumDate } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/tenant";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentReservationsTable } from "@/components/dashboard/recent-reservations-table";
import { ChannelHealthCard } from "@/components/channels/channel-health-card";
import { SyncAllButton } from "@/components/channels/sync-all-button";
import { ReservationStatusBadge, ChannelLabel } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const hotelId = await getCurrentHotelId();
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const day = today();

  const [user, stats, recent, channelHealth, roomTypes, roomsRaw, ratePlansRaw, guestsRaw] = await Promise.all([
    getCurrentUser(),
    getDashboardStats(hotelId, day),
    getRecentReservations(hotelId, 20),
    getChannelHealth(hotelId),
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" } }),
    db.room.findMany({
      where: { hotelId },
      include: { roomType: { select: { name: true } } },
      orderBy: { number: "asc" },
    }),
    db.ratePlan.findMany({ where: { hotelId }, orderBy: { name: "asc" } }),
    db.guest.findMany({ where: { hotelId }, orderBy: { fullName: "asc" } }),
  ]);

  const rooms: RoomVM[] = roomsRaw.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    status: r.status as RoomVM["status"],
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    guestTonight: null,
  }));
  const ratePlans: RatePlanVM[] = ratePlansRaw.map((p) => ({
    id: p.id,
    name: p.name,
    roomTypeId: p.roomTypeId,
    roomTypeName: roomTypes.find((t) => t.id === p.roomTypeId)?.name ?? "",
    basePrice: p.basePrice,
    currency: p.currency,
    refundable: p.refundable,
    breakfastIncluded: p.breakfastIncluded,
  }));
  const guests: GuestVM[] = guestsRaw.map((g) => ({
    id: g.id,
    fullName: g.fullName,
    email: g.email,
    phone: g.phone,
    country: g.country,
    notes: g.notes,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${greeting()}, ${user?.fullName || "User"}`}
        description={`${hotel.name} · ${formatMediumDate(day)}`}
      >
        <SyncAllButton />
      </PageHeader>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          label={t.dashboard.kpi.occupancy}
          value={formatPercent(stats.occupancyTonight)}
          sub={t.dashboard.kpi.occupancySub(stats.occupiedTonight, stats.totalRooms)}
          icon={Percent}
          accent
        />
        <KpiCard
          label={t.dashboard.kpi.reservations}
          value={String(stats.activeReservations)}
          sub={t.dashboard.kpi.reservationsSub}
          icon={CalendarCheck2}
        />
        <KpiCard
          label={t.dashboard.kpi.arrivalsToday}
          value={String(stats.arrivalsToday.length)}
          sub={t.dashboard.kpi.arrivalsSub(stats.arrivalsToday.filter((r) => r.status === "CHECKED_IN").length)}
          icon={ArrowUp}
        />
        <KpiCard
          label={t.dashboard.kpi.departuresToday}
          value={String(stats.departuresToday.length)}
          sub={t.dashboard.kpi.departuresSub(stats.departuresToday.filter((r) => r.status === "CHECKED_OUT").length)}
          icon={ArrowDown}
        />
        <KpiCard
          label={t.dashboard.kpi.revenueMtd}
          value={formatMoney(stats.revenueMonthToDate)}
          sub={t.dashboard.kpi.revenueSub}
          icon={ReceiptText}
        />
        <KpiCard
          label={t.dashboard.kpi.availableRooms}
          value={String(stats.availableRoomsTonight)}
          sub={t.dashboard.kpi.availableRoomsSub(stats.inHouseGuests)}
          icon={BedDouble}
        />
      </div>

      {/* Today's operations */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card shadow-sm">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">{t.dashboard.arrivalsSection}</h2>
              <p className="text-sm text-muted-foreground">{formatMediumDate(day)}</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {stats.arrivalsToday.length}
            </span>
          </header>
          <div className="overflow-x-auto">
            {stats.arrivalsToday.length === 0 ? (
              <EmptyState icon={CalendarCheck2} title={t.dashboard.noArrivals} className="m-3 border-0 bg-transparent py-8" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t.dashboard.table.guest}</TableHead>
                    <TableHead>{t.dashboard.table.room}</TableHead>
                    <TableHead>{t.dashboard.table.nights}</TableHead>
                    <TableHead>{t.dashboard.table.channel}</TableHead>
                    <TableHead>{t.dashboard.table.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.arrivalsToday.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.guest.fullName}</TableCell>
                      <TableCell>{r.room.number}</TableCell>
                      <TableCell>{nightsOf(r.checkIn, r.checkOut)}</TableCell>
                      <TableCell>
                        <ChannelLabel channel={r.sourceChannel} />
                      </TableCell>
                      <TableCell>
                        <ReservationStatusBadge status={r.status as never} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-sm">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">{t.dashboard.departuresSection}</h2>
              <p className="text-sm text-muted-foreground">{formatMediumDate(day)}</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              {stats.departuresToday.length}
            </span>
          </header>
          <div className="overflow-x-auto">
            {stats.departuresToday.length === 0 ? (
              <EmptyState icon={CalendarX2} title={t.dashboard.noDepartures} className="m-3 border-0 bg-transparent py-8" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t.dashboard.table.guest}</TableHead>
                    <TableHead>{t.dashboard.table.room}</TableHead>
                    <TableHead>{t.dashboard.table.channel}</TableHead>
                    <TableHead>{t.dashboard.table.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.departuresToday.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.guest.fullName}</TableCell>
                      <TableCell>{r.room.number}</TableCell>
                      <TableCell>
                        <ChannelLabel channel={r.sourceChannel} />
                      </TableCell>
                      <TableCell>
                        <ReservationStatusBadge status={r.status as never} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </div>

      {/* Recent reservations */}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <header className="mb-4">
          <h2 className="font-semibold">{t.dashboard.recentReservations}</h2>
          <p className="text-sm text-muted-foreground">{t.dashboard.recentSubtitle}</p>
        </header>
        <RecentReservationsTable
          reservations={recent.map(toReservationVM)}
          rooms={rooms}
          ratePlans={ratePlans}
          guests={guests}
          hotelCurrency={hotel.currency}
        />
      </section>

      {/* Channel health */}
      <ChannelHealthCard rows={channelHealth} />
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return t.dashboard.goodMorning;
  if (h < 18) return t.dashboard.goodAfternoon;
  return t.dashboard.goodEvening;
}

function nightsOf(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
