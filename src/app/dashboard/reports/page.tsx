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
import { getRequestLocale } from "@/lib/locale-server";

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
  const locale = await getRequestLocale();
  const kk = locale === "kk";

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
      <div className="order-0 hidden sm:block"><PageHeader title={kk ? "Есептер" : "Отчёты"} description={kk ? "Таңдалған кезеңдегі жүктеме, табыс және юниттердің тиімділігі." : "Загрузка, выручка и эффективность номерного фонда за выбранный период."}>
        <DataExportDialog dataset="reports" defaultFrom={report.period.from} defaultTo={report.period.to} defaultSource={selectedSource} maxTo={currentDateText} />
      </PageHeader></div>

      <form action="/dashboard/reports" method="get" className="order-2 hidden gap-3 rounded-xl border bg-card p-3 shadow-sm sm:grid sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_1fr_1.2fr_auto_auto] lg:items-end">
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

      <section className="order-1 space-y-4 sm:hidden"><header><h1 className="sh-mobile-title">{kk ? "Есептер" : "Отчёты"}</h1><p className="sh-mobile-eyebrow">{new Intl.DateTimeFormat(kk ? "kk-KZ" : "ru-RU", { month: "long", year: "numeric" }).format(new Date(`${report.period.to}T00:00:00Z`))}</p></header><div className="sh-mobile-card flex h-11 items-center justify-between px-3"><span className="text-[#9aa099]">‹</span><b className="text-xs text-[#35413a]">{formatISODate(report.period.from)} — {formatISODate(report.period.to)}</b><span className="text-[#9aa099]">›</span></div><div className="grid grid-cols-3 gap-2"><MiniKpi label={kk ? "Табыс" : "Доход"} value={money(report.summary.revenue, true)} delta="+12%" tone="green" /><MiniKpi label={kk ? "Жүктеме" : "Загрузка"} value={formatPercent(report.summary.occupancy)} delta="+6%" tone="blue" /><MiniKpi label="ADR" value={money(report.summary.adr, true)} delta="-2%" tone="amber" /></div><div><h2 className="sh-mobile-section-title mb-2">{kk ? "Апталар бойынша табыс" : "Доход по неделям"}</h2><div className="sh-mobile-card relative flex h-44 items-end gap-2 overflow-hidden px-4 pb-6 pt-5">{chronologicalDaily.slice(-7).map((row) => { const max = Math.max(1, ...chronologicalDaily.slice(-7).map((item) => item.revenue)); return <div key={row.date.toISOString()} className="flex h-full flex-1 flex-col justify-end gap-1"><div className="w-full rounded-t-md bg-gradient-to-t from-[#07866b] to-[#1ca184]" style={{ height: `${Math.max(12, row.revenue / max * 100)}%` }} /><span className="text-center text-[8px] font-semibold text-[#969c95]">{row.date.getUTCDate()}</span></div>; })}<div className="pointer-events-none absolute left-1/2 top-6 size-24 -translate-x-1/2 rotate-45 border-8 border-[#e7dfc8]/20" /></div></div><div><h2 className="sh-mobile-section-title mb-2">{kk ? "Арналар" : "Каналы"}</h2><div className="sh-mobile-card space-y-3 p-4">{report.revenueBySource.map((row, index) => <div key={row.source} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[10px]"><span className="flex items-center gap-2 font-bold text-[#4a554f]"><i className={`size-2 rounded-full ${["bg-[#07866b]", "bg-[#568ddd]", "bg-[#7458b5]", "bg-[#f2ac2f]"][index % 4]}`} />{channelLabel(row.source)}</span><b className="text-[#3c4841]">{money(row.value, true)}</b><span className="w-8 text-right text-[#969c95]">{Math.round(row.value / Math.max(1, report.summary.revenue) * 100)}%</span></div>)}</div></div></section>
      <div className="order-3 hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Загрузка" value={formatPercent(report.summary.occupancy)} sub={`${report.summary.occupiedRoomNights} из ${report.summary.availableRoomNights} номеро-ночей`} icon={Percent} accent />
        <KpiCard label="Выручка" value={money(report.summary.revenue)} sub={`За ${report.period.days} дн.`} icon={ReceiptText} />
        <KpiCard label="ADR" value={money(report.summary.adr)} sub="Средняя цена проданной ночи" icon={CircleDollarSign} />
        <KpiCard label="RevPAR" value={money(report.summary.revpar)} sub="Выручка на доступный номер" icon={BedDouble} />
      </div>

      <div className="order-3 hidden gap-6 sm:grid xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
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
      <details className="order-4 hidden rounded-xl border bg-card"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Показатели по дням · полный отчёт</summary><div className="overflow-x-auto border-t p-3"><DailyMetricsTable rows={dailyRows} /></div></details>
    </div>
  );
}

function MiniKpi({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: "green" | "blue" | "amber" }) {
  const color = tone === "green" ? "text-[#13836a]" : tone === "blue" ? "text-[#4f86d6]" : "text-[#c48729]";
  return <div className="sh-mobile-card min-w-0 p-3"><p className="truncate text-[9px] font-semibold text-[#959b94]">{label}</p><p className="mt-1 truncate text-sm font-extrabold text-[#2e3a34]">{value}</p><p className={`mt-1 text-[9px] font-bold ${color}`}>{delta}</p></div>;
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
