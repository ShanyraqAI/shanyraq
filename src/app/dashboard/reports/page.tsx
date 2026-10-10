import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DataExportDialog } from "@/components/exports/data-export-dialog";
import { InteractiveTrendChart } from "@/components/charts/interactive-trend-chart";
import { DailyMetricsTable } from "@/components/reports/daily-metrics-table";
import { ExpensePanel } from "@/components/reports/expense-panel";
import { PeriodFilter } from "@/components/reports/period-filter";
import { ReportTabs, parseReportTab } from "@/components/reports/report-tabs";
import { UnitFinanceList } from "@/components/reports/unit-finance-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatISODate, formatShortDate, todayInTimeZone, toISODate } from "@/lib/dates";
import { channelLabel } from "@/lib/i18n";
import { expensesByCategory } from "@/lib/reports/expenses";
import { formatReportMoney } from "@/lib/reports/format";
import { parseReportFilters } from "@/lib/reports/performance";
import { getGeneralExpenses, getHotelPerformanceReport, getUnitFinanceReport } from "@/lib/reports/service";
import { getCurrentHotel } from "@/lib/tenant";
import { formatPercent } from "@/lib/utils";
import { requireSectionAccess } from "@/server/guards";
import { getRequestLocale } from "@/lib/locale-server";
import { createFinancialOperationAction, saveChannelCommissionAction, saveIncomeTaxRateAction } from "@/server/actions/finance";

export const dynamic = "force-dynamic";

type ReportSearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
  source?: string | string[];
  month?: string | string[];
  tab?: string | string[];
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
  const tab = parseReportTab(params.tab);
  const currentMonth = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const firstReportDate = new Date(Date.UTC(hotel.createdAt.getUTCFullYear(), hotel.createdAt.getUTCMonth(), 1));
  const firstReportMonth = `${firstReportDate.getUTCFullYear()}-${String(firstReportDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const requestedMonth = typeof params.month === "string" && params.month >= firstReportMonth ? params.month : currentMonth;
  const filters = parseReportFilters({ ...params, month: params.from || params.to ? undefined : requestedMonth }, currentDate);
  const monthValue = `${filters.from.getUTCFullYear()}-${String(filters.from.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthCount = Math.max(1, (currentDate.getUTCFullYear() - firstReportDate.getUTCFullYear()) * 12 + currentDate.getUTCMonth() - firstReportDate.getUTCMonth() + 1);
  const monthOptions = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - index, 1));
    return { value: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat(kk ? "kk-KZ" : "ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(date) };
  });
  const generalExpenses = await getGeneralExpenses(hotel.id, filters);
  const report = await getHotelPerformanceReport(hotel.id, filters, generalExpenses);
  const [unitRows, rooms] = await Promise.all([
    tab === "units" ? getUnitFinanceReport(hotel.id, filters, report.currency, generalExpenses) : Promise.resolve([]),
    tab === "expenses" ? db.room.findMany({ where: { hotelId: hotel.id }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true } }) : Promise.resolve([]),
  ]);
  const commissionSources = [...new Set([...report.sources, ...report.commissionSettings.map((item) => item.sourceChannel), "booking", "airbnb", "ostrovok", "bronevik", "expedia", "krisha"])];
  const selectedSource = filters.source ?? "all";
  const money = (amount: number, compact = false) => formatReportMoney(amount, report.currency, compact);
  const chronologicalDaily = [...report.daily].reverse();
  const maxRevenue = Math.max(1, ...report.revenueBySource.map((row) => row.value));
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
  const roomNames = new Map(rooms.map((room) => [room.id, room.number]));
  const expenseItems = generalExpenses.map((row) => ({
    id: row.id,
    date: formatShortDate(row.occurredAt),
    amount: row.amount,
    category: row.category,
    comment: row.comment,
    roomLabel: row.roomIds.length === 0 ? "все квартиры" : row.roomIds.map((id) => roomNames.get(id)).filter(Boolean).join(", ") || "все квартиры",
  }));
  const generalTotal = generalExpenses.reduce((sum, row) => sum + row.amount, 0);
  const finance = report.finance;
  const profit = finance.netProfitAfterTax ?? finance.netProfitBeforeTax;
  const filterQuery: Record<string, string> = { month: monthValue };
  if (selectedSource !== "all") filterQuery.source = selectedSource;

  return (
    <div className="space-y-5">
      <div className="hidden sm:block"><PageHeader title={kk ? "Есептер" : "Отчёты"} description={kk ? "Табыс, шығын, пайда және жүктеме: объект бойынша және әр пәтер бойынша." : "Доход, расходы, прибыль и загрузка — по объекту и по каждой квартире."}>
        <DataExportDialog dataset="reports" defaultFrom={report.period.from} defaultTo={report.period.to} defaultSource={selectedSource} maxTo={currentDateText} />
      </PageHeader></div>
      <header className="flex items-start gap-3 sm:hidden"><Link href="/dashboard/more" className="grid size-9 shrink-0 place-items-center rounded-full bg-white ring-1 ring-[#e6e8df]" aria-label={kk ? "Артқа" : "Назад"}><ChevronLeft className="size-5" /></Link><div className="min-w-0 flex-1"><h1 className="sh-mobile-title">{kk ? "Есептер" : "Отчёты"}</h1><p className="sh-mobile-eyebrow">{formatISODate(report.period.from)} — {formatISODate(report.period.to)}</p></div></header>

      <PeriodFilter month={monthValue} months={monthOptions} source={selectedSource} sources={report.sources.map((source) => ({ value: source, label: channelLabel(source) }))} tab={tab} locale={locale} />
      <ReportTabs active={tab} query={filterQuery} locale={locale} />

      {tab === "overview" ? <>
        <section aria-label={kk ? "Пайда" : "Прибыль"} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#158b72] to-[#08634f] p-5 text-white shadow-lg shadow-emerald-950/10">
          <div className="absolute -bottom-16 -right-8 size-44 rounded-full border-[18px] border-[#dbc783]/25" />
          <div className="relative">
            <p className="text-xs font-semibold text-white/75">{kk ? "Таза пайда" : "Прибыль за период"}</p>
            <p className={`mt-1 text-3xl font-extrabold tracking-tight tabular-nums ${profit < 0 ? "text-[#ffd3cd]" : ""}`}>{money(profit)}</p>
            <p className="mt-1 text-[11px] text-white/60">{finance.taxRatePercent === null ? (kk ? "Салыққа дейін" : "До налога · ставка не задана на вкладке «Платежи»") : (kk ? "Салық шегерілген" : `После налога ${finance.taxRatePercent}%`)}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-xs">
              <div><dt className="text-white/65">{kk ? "Табыс" : "Доход"}</dt><dd className="mt-0.5 font-extrabold tabular-nums">{money(report.summary.revenue, true)}</dd></div>
              <div><dt className="text-white/65">{kk ? "Комиссия" : "Комиссия"}</dt><dd className="mt-0.5 font-extrabold tabular-nums">−{money(finance.commission, true)}</dd></div>
              <div><dt className="text-white/65">{kk ? "Шығын" : "Расходы"}</dt><dd className="mt-0.5 font-extrabold tabular-nums">−{money(finance.expenses, true)}</dd></div>
            </dl>
          </div>
        </section>
        {finance.missingCommissionCount > 0 ? <p className="rounded-xl bg-[#fff7e6] p-3 text-xs font-semibold text-[#8a5a12]">{kk ? `Комиссиясы белгісіз броньдар: ${finance.missingCommissionCount}. Пайда шамамен.` : `Не указана комиссия у ${finance.missingCommissionCount} броней — прибыль приблизительная. Задайте ставки на вкладке «Платежи».`}</p> : null}
        {finance.expenses === 0 ? <p className="rounded-xl bg-[#eef6f2] p-3 text-xs font-semibold text-[#2c6a58]">{kk ? "Шығындар енгізілмеген — пайда табысқа тең. «Шығындар» бөлімінде қосыңыз." : "Расходы не внесены — прибыль равна доходу за вычетом комиссии. Добавьте их на вкладке «Расходы»."} <Link href={`/dashboard/reports?${new URLSearchParams({ ...filterQuery, tab: "expenses" })}`} className="underline">{kk ? "Қосу" : "Добавить"}</Link></p> : null}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={kk ? "Көрсеткіштер" : "Показатели"}>
          <Stat label={kk ? "Жүктеме" : "Загрузка"} value={formatPercent(report.summary.occupancy)} note={`${report.summary.occupiedRoomNights} из ${report.summary.availableRoomNights} ${kk ? "түн" : "ночей"}`} />
          <Stat label="ADR" value={money(report.summary.adr)} note={kk ? "Сатылған түннің орташа бағасы" : "Средняя цена занятой ночи"} />
          <Stat label="RevPAR" value={money(report.summary.revpar)} note={kk ? "Қолжетімді түнге табыс" : "Доход на доступную ночь"} />
          <Stat label={kk ? "Түндер" : "Занято ночей"} value={String(report.summary.occupiedRoomNights)} note={`${report.period.days} ${kk ? "күн" : "дн."}`} />
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <section className="sh-mobile-card min-w-0 p-4">
            <h2 className="sh-mobile-section-title">{kk ? "Жүктеме динамикасы" : "Загрузка по дням"}</h2>
            <p className="mb-3 text-[11px] text-[#8b9189]">{kk ? "Сызыққа тиіп күнді қараңыз" : "Коснитесь графика, чтобы увидеть день"}</p>
            <InteractiveTrendChart points={occupancyPoints} maxValue={100} ariaLabel="Интерактивная динамика загрузки по дням" />
          </section>
          <section className="sh-mobile-card p-4">
            <h2 className="sh-mobile-section-title">{kk ? "Арналар бойынша табыс" : "Доход по источникам"}</h2>
            <ul className="mt-3 space-y-3">
              {report.revenueBySource.map((row) => <li key={row.source}><div className="mb-1 flex justify-between text-xs"><span className="font-bold text-[#39463f]">{channelLabel(row.source)}</span><span className="tabular-nums"><b>{money(row.value, true)}</b> · {Math.round(row.value / Math.max(1, report.summary.revenue) * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0e8]"><div className="h-full rounded-full bg-[#07866b]" style={{ width: `${Math.max(3, row.value / maxRevenue * 100)}%` }} /></div></li>)}
              {report.revenueBySource.length === 0 ? <li className="py-4 text-center text-sm text-[#8b9189]">{kk ? "Дерек жоқ" : "Нет броней за период"}</li> : null}
            </ul>
          </section>
        </div>
        <details className="sh-mobile-card"><summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">{kk ? "Күндер бойынша көрсеткіштер" : "Показатели по дням"}</summary><div className="overflow-x-auto border-t p-3"><DailyMetricsTable rows={dailyRows} locale={locale} /></div></details>
      </> : null}

      {tab === "units" ? <>
        <p className="text-xs text-[#7b847d]">{kk ? "Тек кезеңге кіретін түндер есептеледі. Пайда = табыс − арна комиссиясы − шығындар." : "Считаются только ночи внутри периода. Прибыль = доход − комиссия канала − расходы (общие расходы делятся поровну между выбранными квартирами)."}</p>
        <UnitFinanceList rows={unitRows} currency={report.currency} locale={locale} />
      </> : null}

      {tab === "expenses" ? <ExpensePanel currency={report.currency} today={currentDateText} rooms={rooms} expenses={expenseItems} categories={expensesByCategory(generalExpenses)} total={generalTotal} filteredBySource={Boolean(filters.source)} /> : null}

      {tab === "payments" ? (
      <Card id="payments" className="scroll-mt-6 border-primary/15">
        <CardHeader><CardTitle className="text-base">{kk ? "Қаржы бойынша брондау" : "Финансы бронирований"}</CardTitle>
          <CardDescription>{kk ? "Арна комиссиясы және төлем жазбалары. Сомалар тек бір валютада қосылады." : "Комиссия канала и записанные оплаты. Складываются только суммы в одной валюте."}</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <FinanceMetric label={kk ? "Сома броньдары" : "Сумма бронирований"} value={report.finance.bookingAmount > 0 ? money(report.finance.bookingAmount) : "Нет данных"} note={kk ? "Дереккөзі: Channex" : "Источник: Channex"} />
          <FinanceMetric label={kk ? "Қызметтер мен алымдар" : "Услуги и сборы"} value={report.finance.serviceCount ? money(report.finance.serviceAmount) : kk ? "Дерек жоқ" : "Нет данных"} note={kk ? "Channex берген мәндер; сомамен қайта қосылмайды" : "Передано Channex; не прибавляются повторно к сумме брони"} />
          <FinanceMetric label={kk ? "Комиссия арналар" : "Комиссия каналов"} value={report.finance.commissionCount ? money(report.finance.commission) : "Нет данных"} note={report.finance.actualCommissionCount ? `Channex: ${report.finance.actualCommissionCount}` : report.finance.estimatedCommissionCount ? `Оценка: ${report.finance.estimatedCommissionCount}` : kk ? "Комиссия берілмейді" : "Комиссия не передана"} />
          <FinanceMetric label={kk ? "Төленді / қайтарылды" : "Оплачено / возвращено"} value={operationsLabel(report.finance.paymentsByCurrency, kk)} note={kk ? "Дереккөзі: жазылған төлемдер" : "Источник: внесённые платежи"} />
          <FinanceMetric label={kk ? "Қонақтан алу керек" : "Осталось получить от гостя"} value={report.finance.remaining === null ? (kk ? "Дерек жоқ" : "Нет данных") : money(report.finance.remaining)} note={kk ? `Объект алатын бронь: ${report.finance.receivableCount}` : `Броней с оплатой объекту: ${report.finance.receivableCount}`} />
          <FinanceMetric label={kk ? "Жазылған шығындар" : "Записанные расходы"} value={report.finance.expenses > 0 ? money(report.finance.expenses) : kk ? "Дерек жоқ" : "Нет данных"} note={kk ? "Қолмен енгізілген" : "По ручным записям"} />
          <FinanceMetric label={kk ? "Таза пайда" : "Чистая прибыль"} value={report.finance.netProfitAfterTax === null ? money(report.finance.netProfitBeforeTax) : money(report.finance.netProfitAfterTax)} note={report.finance.taxRatePercent === null ? (kk ? "Салық мөлшерлемесі орнатылмаған · салыққа дейін" : "Ставка налога не задана · до налога") : (kk ? `${report.finance.taxRatePercent}% салық бағасы шегерілді` : `${report.finance.taxRatePercent}% налога вычтено по вашей ставке`)} />
          <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">{kk ? "Төлем арналарының жиынтығы төлемді растау болып саналмайды. Объектінің нақты төлемі қолжетімді емес." : "Способ оплаты канала не подтверждает зачисление. Выплата OTA и налоговые данные из Channex недоступны; прибыль рассчитывается по известной комиссии и записанным расходам."}</p>
          {report.finance.missingCommissionCount > 0 ? <p className="text-xs font-medium text-amber-800 sm:col-span-2 xl:col-span-4">{kk ? `Комиссиясы белгісіз броньдар: ${report.finance.missingCommissionCount}. Таза табыс бағалау болып табылады.` : `Для ${report.finance.missingCommissionCount} броней комиссия не передана. Итоговая прибыль может быть выше реальной.`}</p> : null}
        </CardContent>
        <CardContent className="border-t pt-4">
          <form action={saveIncomeTaxRateAction} className="flex flex-wrap items-end gap-3">
            <label className="min-w-40 flex-1 space-y-1 text-xs text-muted-foreground">{kk ? "Салық мөлшерлемесі, %" : "Ставка налога, %"}<input name="incomeTaxRatePercent" type="number" min="0" max="100" step="0.01" defaultValue={report.finance.taxRatePercent ?? ""} placeholder={kk ? "Орнатылмаған" : "Не задана"} className="h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground" /></label>
            <Button type="submit" variant="outline">{kk ? "Салықты сақтау" : "Сохранить ставку"}</Button>
            <p className="basis-full text-xs text-muted-foreground">{kk ? "Өзіңіздің салық режиміңізге сай мәнді енгізіңіз. Есеп салықты осы мөлшерлеме бойынша бағалайды." : "Укажите ставку вашего налогового режима. Это оценка от выручки за период, не налоговая декларация."}</p>
          </form>
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
          <h3 className="mb-3 text-sm font-semibold">{kk ? "Комиссия арнасы" : "Комиссия каналов"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {commissionSources.map((source) => {
              const setting = report.commissionSettings.find((item) => item.sourceChannel === source);
              return <form key={source} action={saveChannelCommissionAction} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3">
                <input type="hidden" name="sourceChannel" value={source} />
                <p className="col-span-2 text-sm font-medium">{channelLabel(source)}</p>
                <label className="space-y-1 text-xs text-muted-foreground">{kk ? "Пайыз" : "Ставка, %"}<input name="ratePercent" type="number" min="0" max="100" step="0.01" defaultValue={setting?.ratePercent ?? ""} placeholder="—" className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" /></label>
                <label className="space-y-1 text-xs text-muted-foreground">{kk ? `Тұрақты жинақ (${report.currency})` : `Фиксированный сбор (${report.currency})`}<input name="fixedFee" type="number" min="0" step="0.01" defaultValue={setting?.fixedFee ?? ""} placeholder="—" className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" /></label>
                <Button className="col-span-2" size="sm" type="submit">{kk ? "Сақтау" : "Сохранить ставку"}</Button>
              </form>;
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{kk ? "Channex нақты комиссияны Booking.com мен Airbnb үшін жібереді. Басқа арналар үшін осы мәнді шарттағы мөлшерлемеге сай енгізіңіз; жалпы мөлшер барлық серіктестерге бірдей емес. Ставка келесі жаңартуларға ғана қолданылады." : "Channex передаёт фактическую комиссию для Booking.com и Airbnb. Для других каналов укажите ставку из договора: универсального процента для всех объектов нет. Настройка применяется к новым обновлениям и сохраняется в брони как оценка."}</p>
        </CardContent> : null}
      </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="sh-mobile-card min-w-0 p-3"><p className="truncate text-[11px] font-bold text-[#737b74]">{label}</p><p className="mt-1 truncate text-lg font-extrabold tabular-nums text-[#26342d]">{value}</p><p className="mt-0.5 truncate text-[10px] text-[#939991]">{note}</p></div>;
}

function FinanceMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold tabular-nums">{value}</div><div className="mt-1 text-[11px] text-muted-foreground">{note}</div></div>;
}

function operationsLabel(rows: Array<{ currency: string; paid: number; refunded: number }>, kk: boolean) {
  const nonZero = rows.filter((row) => row.paid > 0 || row.refunded > 0);
  if (!nonZero.length) return kk ? "Дерек жоқ" : "Нет данных";
  return nonZero.map((row) => `${row.currency}: ${kk ? "төленді" : "оплачено"} ${formatReportMoney(row.paid, row.currency)} / ${kk ? "қайтарылды" : "возвращено"} ${formatReportMoney(row.refunded, row.currency)}`).join(" · ");
}

