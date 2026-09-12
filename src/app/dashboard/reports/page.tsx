import Link from "next/link";
import { BedDouble, CalendarRange, CircleDollarSign, Percent, ReceiptText } from "lucide-react";
import { DataExportDialog } from "@/components/exports/data-export-dialog";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatShortDate, todayInTimeZone } from "@/lib/dates";
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

  const filters = parseReportFilters(await searchParams, todayInTimeZone(hotel.timezone));
  const report = await getHotelPerformanceReport(hotel.id, filters);
  const selectedSource = filters.source ?? "all";
  const maxRevenue = Math.max(1, ...report.revenueBySource.map((row) => row.value));
  const labelStep = Math.max(1, Math.ceil(report.daily.length / 12));
  const money = (amount: number, compact = false) => formatReportMoney(amount, report.currency, compact);

  return (
    <div className="space-y-6">
      <PageHeader title="Отчёты" description="Загрузка, выручка и эффективность номерного фонда за выбранный период.">
        <DataExportDialog dataset="reports" defaultFrom={report.period.from} defaultTo={report.period.to} defaultSource={selectedSource} />
      </PageHeader>

      <form action="/dashboard/reports" method="get" className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto_auto] lg:items-end">
        <div className="space-y-1.5"><Label htmlFor="report-from">Дата с</Label><Input id="report-from" name="from" type="date" defaultValue={report.period.from} required /></div>
        <div className="space-y-1.5"><Label htmlFor="report-to">Дата по</Label><Input id="report-to" name="to" type="date" min={report.period.from} defaultValue={report.period.to} required /></div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Загрузка" value={formatPercent(report.summary.occupancy)} sub={`${report.summary.occupiedRoomNights} из ${report.summary.availableRoomNights} номеро-ночей`} icon={Percent} accent />
        <KpiCard label="Выручка" value={money(report.summary.revenue)} sub={`За ${report.period.days} дн.`} icon={ReceiptText} />
        <KpiCard label="ADR" value={money(report.summary.adr)} sub="Средняя цена проданной ночи" icon={CircleDollarSign} />
        <KpiCard label="RevPAR" value={money(report.summary.revpar)} sub="Выручка на доступный номер" icon={BedDouble} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <Card className="min-w-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Динамика загрузки</CardTitle><CardDescription>{report.period.from} — {report.period.to} · доступный фонд рассчитан по текущему статусу номеров</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="flex h-[220px] min-w-[720px] items-end gap-1.5">
              {report.daily.map((day, index) => (
                <div key={day.date.toISOString()} className="group flex min-w-2 flex-1 flex-col items-center justify-end gap-1.5" title={`${formatShortDate(day.date)} · ${formatPercent(day.occupancy)} · ${money(day.revenue)}`}>
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100">{formatPercent(day.occupancy)}</span>
                  <div className="w-full rounded-t-md bg-primary/70 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(4, day.occupancy * 150)}px` }} />
                  <span className="h-4 whitespace-nowrap text-[10px] text-muted-foreground">{index % labelStep === 0 || index === report.daily.length - 1 ? formatShortDate(day.date) : ""}</span>
                </div>
              ))}
            </div>
          </CardContent>
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

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Показатели по дням</CardTitle><CardDescription>Выручка распределяется по ночам проживания пропорционально полной стоимости бронирования.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Дата</TableHead><TableHead className="text-right">Занято</TableHead><TableHead className="text-right">Загрузка</TableHead><TableHead className="text-right">Выручка</TableHead><TableHead className="text-right">ADR</TableHead><TableHead className="text-right">RevPAR</TableHead></TableRow></TableHeader>
            <TableBody>{report.daily.map((day) => (
              <TableRow key={day.date.toISOString()}><TableCell className="font-medium">{formatShortDate(day.date)}</TableCell><TableCell className="text-right tabular-nums">{day.occupiedRooms} / {day.availableRooms}</TableCell><TableCell className="text-right tabular-nums">{formatPercent(day.occupancy)}</TableCell><TableCell className="text-right tabular-nums">{money(day.revenue)}</TableCell><TableCell className="text-right tabular-nums">{money(day.adr)}</TableCell><TableCell className="text-right tabular-nums">{money(day.revpar)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </CardContent>
      </Card>
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
