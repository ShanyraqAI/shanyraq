"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Maximize2, Plus } from "lucide-react";
import { addDays, formatISOCompactDate, parseISODate, toISODate, weekdayShort } from "@/lib/dates";
import type { ReservationVM, RoomVM } from "@/lib/types";
import { mobileCopy, type AppLocale } from "@/lib/locale";
import { calendarSelectionHref } from "@/lib/reservations/calendar-navigation";
import { cn } from "@/lib/utils";
import { calendarStayPosition, type CalendarRangeDays } from "@/lib/reservations/calendar-range";

interface Props {
  locale: AppLocale;
  anchorISO: string;
  todayISO: string;
  rangeDays: CalendarRangeDays;
  rooms: RoomVM[];
  reservations: ReservationVM[];
  navigating: boolean;
  onShift: (days: number) => void;
  onToday: () => void;
  onRangeChange: (days: CalendarRangeDays) => void;
  onOpen: (reservationId: string) => void;
  onCreate: (roomId?: string, date?: string) => void;
  onExpand: () => void;
}

const ROOM_COLUMN = 76;
const DAY_COLUMN = 42;

export function MobileCalendar(props: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const copy = mobileCopy[props.locale].calendar;
  const statusLabels: Record<string, string> = props.locale === "kk"
    ? { PENDING: "Күтуде", CONFIRMED: "Расталған", CHECKED_IN: "Орналасты", CHECKED_OUT: "Шықты" }
    : { PENDING: "Ожидает", CONFIRMED: "Подтверждено", CHECKED_IN: "Заселён", CHECKED_OUT: "Выехал" };
  const visibleDays = props.rangeDays === 30 ? 30 : 7;
  const start = parseISODate(props.anchorISO);
  const days = Array.from({ length: visibleDays }, (_, index) => addDays(start, index));
  const end = days[days.length - 1];
  const period = `${formatISOCompactDate(props.anchorISO)}–${formatISOCompactDate(toISODate(end))}`;
  const timelineWidth = ROOM_COLUMN + DAY_COLUMN * visibleDays;
  const gridTemplate = `${ROOM_COLUMN}px repeat(${visibleDays}, ${DAY_COLUMN}px)`;

  return (
    <div className="space-y-4 pb-40 sm:pb-2">
      <header><h1 className="sh-mobile-title">{copy.title}</h1><p className="sh-mobile-eyebrow">{props.locale === "kk" ? `${props.rooms.length} пәтер` : `${props.rooms.length} квартир`}</p></header>

      <div className="grid grid-cols-[1fr_1fr_auto] rounded-2xl bg-white p-1 shadow-sm ring-1 ring-[#e7e9e1]">
        <button type="button" onClick={() => props.onRangeChange(7)} aria-pressed={props.rangeDays !== 30} className="min-h-11 rounded-xl text-xs font-bold text-[#7d847d] aria-pressed:bg-[#07866b] aria-pressed:text-white">{props.locale === "kk" ? "Апта" : "Неделя"}</button>
        <button type="button" onClick={() => props.onRangeChange(30)} aria-pressed={props.rangeDays === 30} className="min-h-11 rounded-xl text-xs font-bold text-[#7d847d] aria-pressed:bg-[#07866b] aria-pressed:text-white">{props.locale === "kk" ? "Ай" : "Месяц"}</button>
        <button type="button" onClick={props.onExpand} className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-[#56635b]">{props.locale === "kk" ? "Көрініс" : "Вид"}<Maximize2 className="size-4" /></button>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" disabled={props.navigating} onClick={() => props.onShift(-visibleDays)} className="grid size-11 place-items-center rounded-full text-[#7c837c]" aria-label={props.locale === "kk" ? "Алдыңғы кезең" : "Предыдущий период"}><ChevronLeft className="size-4" /></button>
        <button type="button" onClick={props.onToday} className="min-h-11 text-sm font-extrabold text-[#2d3a34]">{period}</button>
        <button type="button" disabled={props.navigating} onClick={() => props.onShift(visibleDays)} className="grid size-11 place-items-center rounded-full text-[#07866b]" aria-label={props.locale === "kk" ? "Келесі кезең" : "Следующий период"}><ChevronRight className="size-4" /></button>
      </div>

      <div className="sh-mobile-card overflow-hidden">
        <div
          className="overflow-x-auto overscroll-x-contain"
          onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
          onTouchEnd={(event) => {
            const point = touchStart.current;
            touchStart.current = null;
            if (!point || props.rangeDays === 30) return;
            const dx = event.changedTouches[0].clientX - point.x;
            const dy = event.changedTouches[0].clientY - point.y;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) props.onShift(dx < 0 ? 7 : -7);
          }}
        >
          <div style={{ width: timelineWidth }}>
            <div className="grid border-b border-[#eceee7] bg-[#fafaf7]" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="sticky left-0 z-20 bg-[#fafaf7]" />
              {days.map((day) => { const iso = toISODate(day); return <button type="button" key={iso} onClick={() => props.onCreate(undefined, iso)} aria-label={`${props.locale === "kk" ? "Күндерді таңдау" : "Выбрать даты"}: ${iso}`} className={cn("flex h-12 flex-col items-center justify-center text-sm text-[#979d96]", iso === props.todayISO && "text-[#07866b]")}><span className="uppercase">{weekdayShort(day)}</span><span className={cn("mt-0.5 grid size-6 place-items-center rounded-full text-sm font-extrabold", iso === props.todayISO && "bg-[#07866b] text-white")}>{day.getUTCDate()}</span></button>; })}
            </div>
            {props.rooms.length ? props.rooms.map((room) => {
              const roomReservations = props.reservations.filter((item) => item.roomId === room.id && item.status !== "CANCELLED" && item.status !== "NO_SHOW" && item.checkIn <= toISODate(end) && item.checkOut >= props.anchorISO);
              return <div key={room.id} className="relative grid min-h-[64px] border-b border-[#eceee7] last:border-0" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="sticky left-0 z-20 flex flex-col justify-center border-r border-[#eceee7] bg-white px-2"><Link href={calendarSelectionHref(room.id)} className="flex min-h-11 items-center text-xs font-extrabold text-[#07866b]" aria-label={`${props.locale === "kk" ? "Пәтер күнтізбесі" : "Календарь квартиры"}: ${room.number}`}><span className="truncate">{room.number}</span></Link><span className="truncate text-sm text-[#a0a59f]">{room.roomTypeName}</span></div>
                {days.map((day) => <button key={toISODate(day)} type="button" aria-label={`${props.locale === "kk" ? "Күндерді таңдау" : "Выбрать даты"}, ${room.number}, ${toISODate(day)}`} onClick={() => props.onCreate(room.id, toISODate(day))} className="border-r border-[#f0f1eb] last:border-0 active:bg-[#eff8f4]" />)}
                {roomReservations.map((reservation) => {
                  const position = calendarStayPosition(reservation.checkIn, reservation.checkOut, start, visibleDays, DAY_COLUMN);
                  if (!position) return null;
                  const tone = reservation.status === "CHECKED_IN" ? "bg-[#0b725d] text-white" : reservation.status === "PENDING" ? "bg-[#fff0cf] text-[#775200]" : reservation.status === "CHECKED_OUT" ? "bg-[#e5e7eb] text-[#374151]" : "bg-[#e3f1ec] text-[#16634f]";
                  const status = statusLabels[reservation.status] ?? reservation.status;
                  const source = reservation.channel === "direct" ? (props.locale === "kk" ? "Тікелей" : "Прямая") : reservation.channel;
                  return <button key={reservation.id} type="button" onClick={() => props.onOpen(reservation.id)} aria-label={`${status} · ${reservation.guestName} · ${source} · ${reservation.checkIn} ${reservation.checkInTime} → ${reservation.checkOut} ${reservation.checkOutTime}`} title={`${status} · ${reservation.guestName} · ${source} · ${reservation.checkInTime} → ${reservation.checkOutTime}`} className={cn("absolute top-2 z-10 h-11 overflow-hidden rounded-lg px-2 py-1 text-left text-sm font-extrabold shadow-sm", tone)} style={{ left: ROOM_COLUMN + position.left, width: position.width }}><span className="block truncate">{reservation.guestName}</span><span className="block truncate text-xs font-medium">{status} · {source}</span></button>;
                })}
              </div>;
            }) : <div className="p-8 text-center text-xs text-[#969c95]">{copy.empty}</div>}
          </div>
        </div>
      </div>

      <ul aria-label={props.locale === "kk" ? "Бронь күйлері" : "Статусы брони"} className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {[["PENDING", "#fff0cf"], ["CONFIRMED", "#e3f1ec"], ["CHECKED_IN", "#0b725d"], ["CHECKED_OUT", "#e5e7eb"]].map(([status, color]) => <li key={status} className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded border" style={{ backgroundColor: color }} />{statusLabels[status]}</li>)}
      </ul>
      <p className="text-sm text-muted-foreground">{props.locale === "kk" ? "Түс бронь күйін білдіреді. Арна бронь мәтінінде көрсетілген." : "Цвет обозначает статус брони. Источник указан в тексте брони."}</p>
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+max(env(safe-area-inset-bottom),5px))] z-40 mx-auto flex max-w-5xl items-center justify-between gap-3 border-t border-[#e8e8df] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(28,47,38,0.08)] backdrop-blur-xl">
        <button type="button" onClick={() => props.onCreate()} className="sh-mobile-primary flex min-h-11 flex-1 items-center justify-center gap-2"><Plus className="size-4" />{copy.newBooking}</button>
        <button type="button" onClick={props.onExpand} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-[13px] border border-[#bfe0d4] bg-[#e4f3ee] px-3.5 text-xs font-bold text-[#087e67] shadow-sm active:bg-[#d4ece3]" aria-label={props.locale === "kk" ? "Күнтізбені кеңейту" : "Развернуть календарь"}><Maximize2 className="size-4" />{props.locale === "kk" ? "Кеңейту" : "Развернуть"}</button>
      </div>
    </div>
  );
}
