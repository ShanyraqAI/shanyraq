import Link from "next/link";
import { BedDouble, CalendarRange, CircleDollarSign, Percent, ReceiptText, TableProperties } from "lucide-react";
import { DataExportDialog } from "@/components/exports/data-export-dialog";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InteractiveTrendChart } from "@/components/charts/interactive-trend-chart";
import { DailyMetricsTable } from "@/components/reports/daily-metrics-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatISODate, formatShortDate, todayInTimeZone, toISODate } from "@/lib/dates";
import { channelLabel } from "@/lib/i18n";
import { parseReportFilters } from "@/lib/reports/performance";
import { getHotelPerformanceReport } from "@/lib/reports/service";
import { getCurrentHotel } from "@/lib/tenant";
import { formatPercent } from "@/lib/utils";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

type ReportSearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
  source?: string | string[];
}>;

export default async function ReportsPage({ searchParams }: { searchParams: ReportSearchParams }) {
  await requireSectionAccess("REPORTS");
  const hotel = await getCurrentHotel();
  if (!hotel) return null;

  const currentDate = todayInTimeZone(hotel.timezone);
  const currentDateText = toISODate(currentDate);
  const filters = parseReportFilters(await searchParams, currentDate);
  const report = await getHotelPerformanceReport(hotel.id, filters);
  const selectedSource = filters.source ?? "all";
  const maxRevenue = Math.max(1, ...report.revenueBySource.map((row) => row.value));
  const money = (amount: number, compact = false) => formatReportMoney(amount, report.currency, compact);
  const chronologicalDaily = [...report.daily].reverse();
  const occupancyPoints = chronologicalDaily.map((day) => ({
    key: day.date.toISOString(),
    label: formatShortDate(day.date),
    value: Math.round(day.occupancy * 100),
    valueLabel: formatPercent(day.occupancy),
    detail: `${day.occupiedRooms} из ${day.availableRooms} занято · ${money(day.revenue)}`,
  }));
  const dailyRows = report.daily.map((day) => ({
    key: day.date.toISOString(),
    date: formatShortDate(day.date),
    occupied: `${day.occupiedRooms} / ${day.availableRooms}`,
    occupancy: formatPercent(day.occupancy),
    revenue: money(day.revenue),
    adr: money(day.adr),
    revpar: money(day.revpar),
  }));

  return (
    <div className="flex flex-col gap-5 sm:block sm:space-y-6">
      <div className="order-0"><PageHeader title="Отчёты" description="Загрузка, выручка и эффективность номерного фонда за выбранный период.">
        <DataExportDialog dataset="reports" defaultFrom={report.period.from} defaultTo={report.period.to} defaultSource={selectedSource} maxTo={currentDateText} />
      </PageHeader></div>

      <form action="/dashboard/reports" method="get" className="order-2 grid gap-3 rounded-xl border bg-card p-3 shadow-sm sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_1fr_1.2fr_auto_auto] lg:items-end">
        <div className="space-y-1.5"><Label htmlFor="report-from">Дата с</Label><Input id="report-from" name="from" type="date" max={currentDateText} defaultValue={report.period.from} required /></div>
        <div className="space-y-1.5"><Label htmlFor="report-to">Дата по</Label><Input id="report-to" name="to" type="date" min={report.period.from} max={currentDateText} defaultValue={report.period.to} required /></div>
        <div className="space-y-1.5">
          <Label htmlFor="report-source">Источник бронирования</Label>
          <select id="report-source" name="source" defaultValue={selectedSource} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="all">Все источники</option>
            {report.sources.map((source) => <option key={source} value={source}>{channelLabel(source)}</option>)}
          </select>
        </div>
        <Button type="submit"><CalendarRange className="size-4" />Показать</Button>
        <Button asChild type="button" variant="outline"><Link href="/dashboard/reports">Сбросить</Link></Button>
      </form>

      <section className="order-1 rounded-2xl border bg-card p-4 shadow-sm sm:hidden"><p className="text-xs font-medium text-muted-foreground">{formatISODate(report.period.from)} — {formatISODate(report.period.to)}</p><p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-primary">{money(report.summary.revenue)}</p><p className="text-xs text-muted-foreground">Выручка за период</p><div className="mt-4 grid grid-cols-2 divide-x border-t pt-3 text-center"><div><p className="text-lg font-semibold tabular-nums">{formatPercent(report.summary.occupancy)}</p><p className="text-xs text-muted-foreground">Загрузка</p></div><div><p className="text-lg font-semibold tabular-nums">{money(report.summary.adr, true)}</p><p className="text-xs text-muted-foreground">Средняя цена ночи</p></div></div></section>
      <div className="order-3 hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Загрузка" value={formatPercent(report.summary.occupancy)} sub={`${report.summary.occupiedRoomNights} из ${report.summary.availableRoomNights} номеро-ночей`} icon={Percent} accent />
        <KpiCard label="Выручка" value={money(report.summary.revenue)} sub={`За ${report.period.days} дн.`} icon={ReceiptText} />
        <KpiCard label="ADR" value={money(report.summary.adr)} sub="Средняя цена проданной ночи" icon={CircleDollarSign} />
        <KpiCard label="RevPAR" value={money(report.summary.revpar)} sub="Выручка на доступный номер" icon={BedDouble} />
      </div>

      <div className="order-3 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <Card className="min-w-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Динамика загрузки</CardTitle><CardDescription>{formatISODate(report.period.from)} — {formatISODate(report.period.to)} · наведите на линию, чтобы увидеть день</CardDescription></CardHeader>
          <CardContent><InteractiveTrendChart points={occupancyPoints} maxValue={100} ariaLabel="Интерактивная динамика загрузки по дням" /></CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Выручка по источникам</CardTitle><CardDescription>{filters.source ? `Фильтр: ${channelLabel(filters.source)}` : "Распределение за выбранный период"}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {report.revenueBySource.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">За период нет выручки.</p> : report.revenueBySource.map((row) => (
              <div key={row.source}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{channelLabel(row.source)}</span><span className="tabular-nums text-muted-foreground">{money(row.value, true)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(row.value / maxRevenue * 100)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="relative order-4 hidden overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.035] shadow-sm sm:block">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-chart-2/65 to-transparent" />
        <CardHeader className="border-b border-primary/10 bg-primary/[0.025] pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10"><TableProperties className="size-5" /></span>
              <div><CardTitle className="text-base">Показатели по дням</CardTitle><CardDescription className="mt-1">Выручка распределяется по ночам проживания пропорционально полной стоимости бронирования.</CardDescription></div>
            </div>
            <span className="hidden rounded-full border border-primary/15 bg-card px-3 py-1 text-[11px] font-medium text-primary sm:inline-flex">Детализация периода</span>
          </div>
        </CardHeader>
        <CardContent className="pt-5"><DailyMetricsTable rows={dailyRows} /></CardContent>
      </Card>
      <details className="order-4 rounded-xl border bg-card sm:hidden"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Показатели по дням · полный отчёт</summary><div className="overflow-x-auto border-t p-3"><DailyMetricsTable rows={dailyRows} /></div></details>
    </div>
  );
}

function formatReportMoney(amount: number, currency: string, compact = false): string {
  try {
    return new Intl.NumberFormat("ru-KZ", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      ...(compact ? { notation: "compact" as const } : {}),
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("ru-RU")} ${currency}`;
  }
}
