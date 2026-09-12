import Link from "next/link";
import { ArrowRight, Bug, Building2, CalendarCheck2, MessageSquareText, Users } from "lucide-react";
import { getSuperAdminOverview } from "@/lib/superadmin/queries";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default async function SuperAdminPage() {
  const { metrics, funnel, hotels, supportRequests } = await getSuperAdminOverview();
  const metricCards = [
    ["Пользователи", metrics.totalUsers, "Всего зарегистрировано"],
    ["Новые сегодня", metrics.newUsersToday, "По UTC"],
    ["Активны сегодня", metrics.activeToday, "Есть beta-событие"],
    ["Активны за 7 дней", metrics.activeSevenDays, "Уникальные пользователи"],
    ["Отели", metrics.totalHotels, `${metrics.totalRooms} номеров`],
    ["Бронирования", metrics.totalReservations, `${metrics.reservationsToday} сегодня`],
    ["Обращения", metrics.feedbackCount, "Из формы помощи"],
    ["Проблемы", metrics.bugReportCount, "Нужны внимание и ответ"],
  ] as const;
  const funnelRows = [
    ["Регистрация", funnel.signup],
    ["Создан отель", funnel.hotel],
    ["Добавлен номер", funnel.room],
    ["Первая бронь", funnel.firstReservation],
    ["Вернулся в другой день", funnel.returnedUser],
    ["Активен за 7 дней", funnel.activeSevenDays],
  ] as const;

  return (
    <main className="space-y-8">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Platform analytics</p>
        <h1 className="text-3xl font-semibold tracking-tight">Закрытая бета</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Активация отелей и продуктовая активность без гостевых данных, паролей, платёжной информации и секретов интеграций.</p>
      </div>

      <section aria-label="Ключевые показатели" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(([label, value, note]) => (
          <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-5 flex items-center gap-3"><Users className="size-5 text-emerald-400" /><h2 className="font-semibold">Воронка активации</h2></div>
          <div className="space-y-4">
            {funnelRows.map(([label, value]) => {
              const percent = funnel.signup ? Math.round((value / funnel.signup) * 100) : 0;
              return (
                <div key={label}>
                  <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="text-slate-300">{label}</span><span className="tabular-nums text-slate-400">{value} · {percent}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${percent}%` }} /></div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-slate-500">Определения централизованы и могут быть скорректированы после первых данных беты.</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Building2 className="size-5 text-emerald-400" /><h2 className="font-semibold">Отели</h2></div>
            <span className="text-xs text-slate-500">Последние 100</span>
          </div>
          <Table>
            <TableHeader><TableRow className="border-white/10 hover:bg-transparent"><TableHead className="text-slate-400">Отель / владелец</TableHead><TableHead className="text-slate-400">Номера</TableHead><TableHead className="text-slate-400">Брони</TableHead><TableHead className="text-slate-400">Регистрация</TableHead><TableHead className="text-slate-400">Активность</TableHead><TableHead className="text-slate-400">Статус</TableHead><TableHead><span className="sr-only">Открыть</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {hotels.map((hotel) => (
                <TableRow key={hotel.id} className="border-white/10 hover:bg-white/[0.04]">
                  <TableCell><div className="font-medium text-white">{hotel.name}</div><div className="max-w-56 truncate text-xs text-slate-500">{hotel.owner?.fullName ?? "Владелец не назначен"}{hotel.owner?.email ? ` · ${hotel.owner.email}` : hotel.owner?.phone ? ` · ${hotel.owner.phone}` : ""}</div></TableCell>
                  <TableCell className="tabular-nums">{hotel.roomCount}</TableCell>
                  <TableCell className="tabular-nums">{hotel.reservationCount}</TableCell>
                  <TableCell className="text-slate-400">{dateFormatter.format(hotel.createdAt)}</TableCell>
                  <TableCell className="text-slate-400">{dateTimeFormatter.format(hotel.lastActivityAt)}</TableCell>
                  <TableCell><Badge variant="secondary" className="bg-white/10 text-slate-200">{hotel.activationStatus}</Badge></TableCell>
                  <TableCell><Link href={`/superadmin/hotels/${hotel.id}`} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label={`Открыть ${hotel.name}`}><ArrowRight className="size-4" /></Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hotels.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Отели ещё не зарегистрированы.</p>}
        </article>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><MessageSquareText className="size-5 text-emerald-400" /><div><h2 className="font-semibold">Обращения из приложения</h2><p className="text-xs text-slate-500">Последние 20 сообщений с контактами владельца</p></div></div>
          <span className="text-xs text-slate-500">{metrics.feedbackCount} всего</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="border-white/10 hover:bg-transparent"><TableHead className="text-slate-400">Отель / пользователь</TableHead><TableHead className="text-slate-400">Тема</TableHead><TableHead className="text-slate-400">Сообщение</TableHead><TableHead className="text-slate-400">Страница</TableHead><TableHead className="text-slate-400">Дата</TableHead></TableRow></TableHeader>
            <TableBody>
              {supportRequests.map((request) => (
                <TableRow key={request.id} className="border-white/10 align-top hover:bg-white/[0.04]">
                  <TableCell>
                    {request.hotel ? (
                      <Link href={`/superadmin/hotels/${request.hotel.id}`} className="font-medium text-white hover:text-emerald-300">
                        {request.hotel.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-white">Публичный сайт</span>
                    )}
                    <div className="mt-1 text-xs text-slate-500">{request.user?.fullName ?? request.name ?? "Посетитель"}</div>
                    <div className="text-xs text-slate-500">{request.user?.email ?? request.user?.phone ?? request.contact ?? "Контакт не указан"}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="bg-white/10 text-slate-200">{{ QUESTION: "Вопрос", PROBLEM: "Проблема", SUGGESTION: "Идея" }[request.category] ?? request.category}</Badge></TableCell>
                  <TableCell className="max-w-xl whitespace-normal text-slate-300">{request.message}</TableCell>
                  <TableCell className="text-xs text-slate-500">{request.sourcePath}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{dateTimeFormatter.format(request.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {supportRequests.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Обращений пока нет.</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryNote icon={CalendarCheck2} title="Активность" text="Считается по серверным событиям успешных операций и открытия календаря." />
        <SummaryNote icon={MessageSquareText} title="Помощь" text="Сообщения из приложения сохраняются с отелем, пользователем и текущей страницей." />
        <SummaryNote icon={Bug} title="Проблемы" text="Категория «Что-то не работает» отдельно отражается в верхней сводке." />
      </section>
    </main>
  );
}

function SummaryNote({ icon: Icon, title, text }: { icon: typeof Bug; title: string; text: string }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><Icon className="size-5 text-emerald-400" /><h2 className="mt-3 font-medium">{title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">{text}</p></article>;
}
