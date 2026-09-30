import Link from "next/link";
import { BedDouble, CalendarRange, ChevronLeft, CircleDollarSign, Percent, ReceiptText, TableProperties } from "lucide-react";
import { DataExportDialog } from "@/components/exports/data-export-dialog";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InteractiveTrendChart } from "@/components/charts/interactive-trend-chart";
import { DailyMetricsTable } from "@/components/reports/daily-metrics-table";
import { MonthSelector } from "@/components/reports/month-selector";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatISODate, formatShortDate, todayInTimeZone, toISODate } from "@/lib/dates";
import { channelLabel } from "@/lib/i18n";
import { parseReportFilters } from "@/lib/reports/performance";
import { getHotelPerformanceReport } from "@/lib/reports/service";
import { getCurrentHotel } from "@/lib/tenant";
import { formatPercent } from "@/lib/utils";
import { requireSectionAccess } from "@/server/guards";
import { getRequestLocale } from "@/lib/locale-server";
import { createFinancialOperationAction, saveChannelCommissionAction } from "@/server/actions/finance";

export const dynamic = "force-dynamic";

type ReportSearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
  source?: string | string[];
  month?: string | string[];
}>;

export default async function ReportsPage({ searchParams }: { searchParams: ReportSearchParams }) {
  await requireSectionAccess("REPORTS");
  const hotel = await getCurrentHotel();
  if (!hotel) return null;
  const locale = await getRequestLocale();
  const kk = locale === "kk";

  const currentDate = todayInTimeZone(hotel.timezone);
  const currentDateText = toISODate(currentDate);
  const params = await searchParams;
  const currentMonth = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const filters = parseReportFilters({ ...params, month: params.month ?? (params.from || params.to ? undefined : currentMonth) }, currentDate);
  const monthValue = `${filters.from.getUTCFullYear()}-${String(filters.from.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthOptions = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - index, 1));
    return { value: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(date) };
  });
  const report = await getHotelPerformanceReport(hotel.id, filters);
  const commissionSources = [...new Set([...report.sources, ...report.commissionSettings.map((item) => item.sourceChannel), "booking", "airbnb", "ostrovok", "bronevik", "expedia", "krisha"])];
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
      <div className="order-0 hidden sm:block"><PageHeader title={kk ? "Есептер" : "Отчёты"} description={kk ? "Таңдалған кезеңдегі жүктеме, табыс және пәтерлердің тиімділігі." : "Загрузка, выручка и эффективность номерного фонда за выбранный период."}>
        <DataExportDialog dataset="reports" defaultFrom={report.period.from} defaultTo={report.period.to} defaultSource={selectedSource} maxTo={currentDateText} />
      </PageHeader></div>

      <form action="/dashboard/reports" method="get" className="order-2 hidden gap-3 rounded-xl border bg-card p-3 shadow-sm sm:grid sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_1.2fr_auto_auto] lg:items-end">
        <div className="space-y-1.5"><Label htmlFor="report-month">Месяц</Label><select id="report-month" name="month" defaultValue={monthValue} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">{monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
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

      <section className="order-1 space-y-4 sm:hidden"><header className="flex items-start gap-3"><Link href="/dashboard/more" className="grid size-9 shrink-0 place-items-center rounded-full bg-white ring-1 ring-[#e6e8df]" aria-label={kk ? "Артқа" : "Назад"}><ChevronLeft className="size-5" /></Link><div className="min-w-0 flex-1"><h1 className="sh-mobile-title">{kk ? "Есептер" : "Отчёты"}</h1><p className="sh-mobile-eyebrow">{kk ? "Айлық көрсеткіштер" : "Показатели по месяцам"}</p></div></header><MonthSelector value={monthValue} options={monthOptions} source={selectedSource} locale={locale} /><div className="grid grid-cols-3 gap-2"><MiniKpi label={kk ? "Табыс" : "Доход"} value={money(report.summary.revenue, true)} delta={kk ? `${report.period.days} күн` : `${report.period.days} дней`} tone="green" /><MiniKpi label={kk ? "Жүктеме" : "Загрузка"} value={formatPercent(report.summary.occupancy)} delta={kk ? "кезеңде" : "за период"} tone="blue" /><MiniKpi label="ADR" value={money(report.summary.adr, true)} delta={kk ? "орташа" : "средняя"} tone="amber" /></div><div><h2 className="sh-mobile-section-title mb-2">{kk ? "Күндер бойынша табыс" : "Доход по дням"}</h2><div className="sh-mobile-card relative flex h-44 items-end gap-2 overflow-hidden px-4 pb-6 pt-5">{chronologicalDaily.slice(-7).map((row) => { const max = Math.max(1, ...chronologicalDaily.slice(-7).map((item) => item.revenue)); return <div key={row.date.toISOString()} className="flex h-full flex-1 flex-col justify-end gap-1"><div className="w-full rounded-t-md bg-gradient-to-t from-[#07866b] to-[#1ca184]" style={{ height: `${Math.max(12, row.revenue / max * 100)}%` }} /><span className="text-center text-[8px] font-semibold text-[#727a73]">{row.date.getUTCDate()}</span></div>; })}</div></div><div><h2 className="sh-mobile-section-title mb-2">{kk ? "Арналар" : "Каналы"}</h2><div className="sh-mobile-card space-y-3 p-4">{report.revenueBySource.map((row, index) => <div key={row.source} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[11px]"><span className="flex items-center gap-2 font-extrabold text-[#39463f]"><i className={`size-2 rounded-full ${["bg-[#07866b]", "bg-[#568ddd]", "bg-[#7458b5]", "bg-[#f2ac2f]"][index % 4]}`} />{channelLabel(row.source)}</span><b className="text-[#2f3b35]">{money(row.value, true)}</b><span className="w-8 text-right font-semibold text-[#737b74]">{Math.round(row.value / Math.max(1, report.summary.revenue) * 100)}%</span></div>)}</div></div></section>
      <div className="order-3 hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Загрузка" value={formatPercent(report.summary.occupancy)} sub={`${report.summary.occupiedRoomNights} из ${report.summary.availableRoomNights} номеро-ночей`} icon={Percent} accent />
        <KpiCard label="Выручка" value={money(report.summary.revenue)} sub={`За ${report.period.days} дн.`} icon={ReceiptText} />
        <KpiCard label="ADR" value={money(report.summary.adr)} sub="Средняя цена проданной ночи" icon={CircleDollarSign} />
        <KpiCard label="RevPAR" value={money(report.summary.revpar)} sub="Выручка на доступный номер" icon={BedDouble} />
      </div>

      <Card id="payments" className="order-3 scroll-mt-6 border-primary/15 sm:order-4">
        <CardHeader><CardTitle className="text-base">{kk ? "Қаржы бойынша брондау" : "Финансы бронирований"}</CardTitle>
          <CardDescription>{kk ? "Арна комиссиясы және төлем жазбалары. Сомалар тек бір валютада қосылады." : "Комиссия канала и записанные оплаты. Складываются только суммы в одной валюте."}</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <FinanceMetric label={kk ? "Сома броньдары" : "Сумма бронирований"} value={report.finance.bookingAmount > 0 ? money(report.finance.bookingAmount) : "Нет данных"} note={kk ? "Дереккөзі: Channex" : "Источник: Channex"} />
          <FinanceMetric label={kk ? "Қызметтер мен алымдар" : "Услуги и сборы"} value={report.finance.serviceCount ? money(report.finance.serviceAmount) : kk ? "Дерек жоқ" : "Нет данных"} note={kk ? "Channex берген мәндер; сомамен қайта қосылмайды" : "Передано Channex; не прибавляются повторно к сумме брони"} />
          <FinanceMetric label={kk ? "Комиссия арналар" : "Комиссия каналов"} value={report.finance.commissionCount ? money(report.finance.commission) : "Нет данных"} note={report.finance.actualCommissionCount ? `Channex: ${report.finance.actualCommissionCount}` : report.finance.estimatedCommissionCount ? `Оценка: ${report.finance.estimatedCommissionCount}` : kk ? "Комиссия берілмейді" : "Комиссия не передана"} />
          <FinanceMetric label={kk ? "Төленді / қайтарылды" : "Оплачено / возвращено"} value={operationsLabel(report.finance.paymentsByCurrency, kk)} note={kk ? "Дереккөзі: жазылған төлемдер" : "Источник: внесённые платежи"} />
          <FinanceMetric label={kk ? "Қонақтан алу керек" : "Осталось получить от гостя"} value={report.finance.remaining === null ? (kk ? "Дерек жоқ" : "Нет данных") : money(report.finance.remaining)} note={kk ? `Объект алатын бронь: ${report.finance.receivableCount}` : `Броней с оплатой объекту: ${report.finance.receivableCount}`} />
          <FinanceMetric label={kk ? "Жазылған шығындар" : "Записанные расходы"} value={report.finance.expenses > 0 ? money(report.finance.expenses) : kk ? "Дерек жоқ" : "Нет данных"} note={kk ? "Қолмен енгізілген" : "По ручным записям"} />
          <FinanceMetric label={kk ? "Салық / объект төлемі / таза пайда" : "Налоги / выплата объекту / чистая прибыль"} value={kk ? "Дерек жоқ" : "Нет данных"} note={kk ? "Жинау тәртібі белгісіз" : "Нет подтверждённых данных об удержании и выплатах"} />
          <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">{kk ? "Төлем арналарының жиынтығы төлемді растау болып саналмайды. Объектінің нақты төлемі қолжетімді емес." : "Способ оплаты канала не подтверждает зачисление. Фактическая выплата объекту пока недоступна."}</p>
        </CardContent>
        {report.reservationOptions.length ? <CardContent className="border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold">{kk ? "Төлем, қайтару немесе шығын қосу" : "Записать оплату, возврат или расход"}</h3>
          <form action={createFinancialOperationAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <label className="space-y-1 text-xs text-muted-foreground lg:col-span-2">{kk ? "Брондау" : "Бронирование"}<select required name="reservationId" className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground">{report.reservationOptions.map((option) => <option key={option.id} value={option.id}>{option.id.slice(-8)} · {formatReportMoney(option.total, option.currency)} ({option.currency})</option>)}</select></label>
            <label className="space-y-1 text-xs text-muted-foreground">{kk ? "Операция" : "Операция"}<select name="type" className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"><option value="PAYMENT">{kk ? "Төлем" : "Оплата"}</option><option value="REFUND">{kk ? "Қайтару" : "Возврат"}</option><option value="EXPENSE">{kk ? "Шығын" : "Расход"}</option></select></label>
            <label className="space-y-1 text-xs text-muted-foreground">{kk ? "Сома" : "Сумма"}<input required name="amount" type="number" min="0.01" step="0.01" className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" /></label>
            <label className="space-y-1 text-xs text-muted-foreground">{kk ? "Тәсіл" : "Способ"}<select name="method" className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"><option value="CASH">{kk ? "Қолма-қол" : "Наличные"}</option><option value="CARD">{kk ? "Карта" : "Карта"}</option><option value="BANK_TRANSFER">{kk ? "Аударым" : "Перевод"}</option><option value="OTA">OTA</option><option value="VCC">VCC</option><option value="OTHER">{kk ? "Басқа" : "Другое"}</option></select></label>
            <label className="space-y-1 text-xs text-muted-foreground">{kk ? "Күні" : "Дата"}<input required name="occurredAt" type="date" defaultValue={currentDateText} className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" /></label>
            <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">{kk ? "Түсініктеме" : "Комментарий"}<input name="description" maxLength={240} className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" /></label>
            <Button type="submit" className="self-end">{kk ? "Сақтау" : "Записать"}</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">{kk ? "Қайтару жазылған төлемнен аспауы тиіс. Жазба ұйым мен объект шегінде сақталады." : "Возврат не может превышать записанную оплату. Запись привязана к организации и объекту."}</p>
        </CardContent> : null}
        {commissionSources.length ? <CardContent className="border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold">{kk ? "Арнаның болжамды комиссиясы" : "Оценочная комиссия канала"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {commissionSources.map((source) => {
              const setting = report.commissionSettings.find((item) => item.sourceChannel === source);
              return <form key={source} action={saveChannelCommissionAction} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3">
                <input type="hidden" name="sourceChannel" value={source} />
                <p className="col-span-2 text-sm font-medium">{channelLabel(source)}</p>
                <label className="space-y-1 text-xs text-muted-foreground">{kk ? "Пайыз" : "Ставка, %"}<input name="ratePercent" type="number" min="0" max="100" step="0.01" defaultValue={setting?.ratePercent ?? 0} className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" /></label>
                <label className="space-y-1 text-xs text-muted-foreground">{kk ? `Тұрақты жинақ (${report.currency})` : `Фиксированный сбор (${report.currency})`}<input name="fixedFee" type="number" min="0" step="0.01" defaultValue={setting?.fixedFee ?? 0} className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" /></label>
                <Button className="col-span-2" size="sm" type="submit">{kk ? "Сақтау" : "Сохранить ставку"}</Button>
              </form>;
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{kk ? "Ставка қолданыстағы броньдарға көшірілмейді. Келесі Channex жаңартуы әр броньда ставка мен дереккөзді сақтайды." : "Ставка не меняет историю. При следующем обновлении Channex ставка и источник сохраняются в бронировании."}</p>
        </CardContent> : null}
      </Card>

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
        <CardContent className="pt-5"><DailyMetricsTable rows={dailyRows} locale={locale} /></CardContent>
      </Card>
      <details className="order-4 rounded-xl border bg-card sm:hidden"><summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">{kk ? "Күндер бойынша көрсеткіштер · толық есеп" : "Показатели по дням · полный отчёт"}</summary><div className="overflow-x-auto border-t p-3"><DailyMetricsTable rows={dailyRows} locale={locale} /></div></details>
    </div>
  );
}

function MiniKpi({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: "green" | "blue" | "amber" }) {
  const color = tone === "green" ? "text-[#13836a]" : tone === "blue" ? "text-[#4f86d6]" : "text-[#c48729]";
  return <div className="sh-mobile-card min-w-0 p-3"><p className="truncate text-[10px] font-bold text-[#737b74]">{label}</p><p className="mt-1 truncate text-base font-extrabold text-[#26342d]">{value}</p><p className={`mt-1 text-[9px] font-bold ${color}`}>{delta}</p></div>;
}

function FinanceMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold tabular-nums">{value}</div><div className="mt-1 text-[11px] text-muted-foreground">{note}</div></div>;
}

function operationsLabel(rows: Array<{ currency: string; paid: number; refunded: number }>, kk: boolean) {
  const nonZero = rows.filter((row) => row.paid > 0 || row.refunded > 0);
  if (!nonZero.length) return kk ? "Дерек жоқ" : "Нет данных";
  return nonZero.map((row) => `${row.currency}: ${kk ? "төленді" : "оплачено"} ${formatReportMoney(row.paid, row.currency)} / ${kk ? "қайтарылды" : "возвращено"} ${formatReportMoney(row.refunded, row.currency)}`).join(" · ");
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
