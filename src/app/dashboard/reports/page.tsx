import { db, getCurrentHotelId } from "@/lib/db";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { addDays, eachDay, formatShortDate, isSameDay, today } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { t, channelLabel } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireSectionAccess("FULL");
  const hotelId = await getCurrentHotelId();
  const day = today();

  const [roomsTotal, reservations] = await Promise.all([
    db.room.count({ where: { hotelId, status: { not: "OUT_OF_ORDER" } } }),
    db.reservation.findMany({
      where: { hotelId },
      select: {
        checkIn: true,
        checkOut: true,
        status: true,
        totalAmount: true,
        sourceChannel: true,
      },
    }),
  ]);

  // Revenue by channel (booked revenue, non-cancelled).
  const revenueByChannel: Record<string, number> = {};
  let totalRevenue = 0;
  for (const r of reservations) {
    if (["CANCELLED", "NO_SHOW"].includes(r.status)) continue;
    revenueByChannel[r.sourceChannel] = (revenueByChannel[r.sourceChannel] ?? 0) + r.totalAmount;
    totalRevenue += r.totalAmount;
  }
  const channelRows = Object.entries(revenueByChannel).sort((a, b) => b[1] - a[1]);

  // Occupancy trend, last 14 days.
  const days = eachDay(addDays(day, -13), addDays(day, 1));
  const active = reservations.filter((r) => (ACTIVE_RESERVATION_STATUSES as readonly string[]).includes(r.status));
  const trend = days.map((d) => {
    const occupied = active.filter((r) => r.checkIn <= d && r.checkOut > d).length;
    return { date: d, occupancy: roomsTotal === 0 ? 0 : Math.min(1, occupied / roomsTotal), occupied };
  });

  const maxRevenue = Math.max(1, ...channelRows.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <PageHeader title={t.reports.title} description={t.reports.description} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t.reports.revenueByChannel}</CardTitle>
            <CardDescription>
              {t.reports.totalRevenueLabel}{" "}
              <strong className="text-foreground tabular-nums">{formatMoney(totalRevenue)}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {channelRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t.reports.noRevenue}</p>
            ) : (
              channelRows.map(([channel, value]) => (
                <div key={channel}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{channelLabel(channel)}</span>
                    <span className="tabular-nums text-muted-foreground">{formatMoney(value, { compact: true })}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round((value / maxRevenue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t.reports.occupancyTrend}</CardTitle>
            <CardDescription>{t.reports.occupancyDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[180px] items-end gap-1.5">
              {trend.map((t) => (
                <div key={t.date.toISOString()} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100">
                    {formatPercent(t.occupancy)}
                  </span>
                  <div
                    className={
                      isSameDay(t.date, day)
                        ? "w-full rounded-t-md bg-primary"
                        : "w-full rounded-t-md bg-primary/40"
                    }
                    style={{ height: `${Math.max(4, t.occupancy * 140)}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{formatShortDate(t.date)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
