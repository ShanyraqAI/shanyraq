"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, Plus } from "lucide-react";
import { addDays, diffDays, formatISOCompactDate, parseISODate, toISODate, weekdayShort } from "@/lib/dates";
import type { ReservationVM, RoomVM } from "@/lib/types";
import { mobileCopy, type AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";
import type { CalendarRangeDays } from "@/lib/reservations/calendar-range";

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
  const visibleDays = props.rangeDays === 30 ? 30 : 7;
  const start = parseISODate(props.anchorISO);
  const days = Array.from({ length: visibleDays }, (_, index) => addDays(start, index));
  const end = days[days.length - 1];
  const period = `${formatISOCompactDate(props.anchorISO)}–${formatISOCompactDate(toISODate(end))}`;
  const timelineWidth = ROOM_COLUMN + DAY_COLUMN * visibleDays;
  const gridTemplate = `${ROOM_COLUMN}px repeat(${visibleDays}, ${DAY_COLUMN}px)`;

  return (
    <div className="space-y-4 pb-2">
      <header><h1 className="sh-mobile-title">{copy.title}</h1><p className="sh-mobile-eyebrow">{props.locale === "kk" ? `${props.rooms.length} пәтер` : `${props.rooms.length} квартир`}</p></header>

      <div className="grid grid-cols-[1fr_1fr_auto] rounded-2xl bg-white p-1 shadow-sm ring-1 ring-[#e7e9e1]">
        <button type="button" onClick={() => props.onRangeChange(7)} aria-pressed={props.rangeDays !== 30} className="min-h-10 rounded-xl text-xs font-bold text-[#7d847d] aria-pressed:bg-[#07866b] aria-pressed:text-white">{props.locale === "kk" ? "Апта" : "Неделя"}</button>
        <button type="button" onClick={() => props.onRangeChange(30)} aria-pressed={props.rangeDays === 30} className="min-h-10 rounded-xl text-xs font-bold text-[#7d847d] aria-pressed:bg-[#07866b] aria-pressed:text-white">{props.locale === "kk" ? "Ай" : "Месяц"}</button>
        <Link href="/dashboard/reservations/filters" className="flex min-h-10 items-center gap-1 rounded-xl px-3 text-[11px] font-bold text-[#727972]">{props.locale === "kk" ? "Сүзгілер" : "Фильтры"}<ChevronDown className="size-3" /></Link>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" disabled={props.navigating} onClick={() => props.onShift(-visibleDays)} className="grid size-9 place-items-center rounded-full text-[#7c837c]" aria-label={props.locale === "kk" ? "Алдыңғы кезең" : "Предыдущий период"}><ChevronLeft className="size-4" /></button>
        <button type="button" onClick={props.onToday} className="text-sm font-extrabold text-[#2d3a34]">{period}</button>
        <button type="button" disabled={props.navigating} onClick={() => props.onShift(visibleDays)} className="grid size-9 place-items-center rounded-full text-[#07866b]" aria-label={props.locale === "kk" ? "Келесі кезең" : "Следующий период"}><ChevronRight className="size-4" /></button>
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
              {days.map((day) => { const iso = toISODate(day); return <div key={iso} className={cn("flex h-12 flex-col items-center justify-center text-[9px] text-[#979d96]", iso === props.todayISO && "text-[#07866b]")}><span className="uppercase">{weekdayShort(day)}</span><span className={cn("mt-0.5 grid size-6 place-items-center rounded-full text-[11px] font-extrabold", iso === props.todayISO && "bg-[#07866b] text-white")}>{day.getUTCDate()}</span></div>; })}
            </div>
            {props.rooms.length ? props.rooms.map((room) => {
              const roomReservations = props.reservations.filter((item) => item.roomId === room.id && item.status !== "CANCELLED" && item.status !== "NO_SHOW" && item.checkIn <= toISODate(end) && item.checkOut > props.anchorISO);
              return <div key={room.id} className="relative grid min-h-[58px] border-b border-[#eceee7] last:border-0" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="sticky left-0 z-20 flex flex-col justify-center border-r border-[#eceee7] bg-white px-2"><span className="truncate text-xs font-extrabold text-[#334039]">{room.number}</span><span className="truncate text-[8px] text-[#a0a59f]">{room.roomTypeName}</span></div>
                {days.map((day) => <button key={toISODate(day)} type="button" aria-label={`${copy.newBooking}, ${room.number}, ${toISODate(day)}`} onClick={() => props.onCreate(room.id, toISODate(day))} className="border-r border-[#f0f1eb] last:border-0 active:bg-[#eff8f4]" />)}
                {roomReservations.map((reservation) => {
                  const from = Math.max(0, diffDays(start, parseISODate(reservation.checkIn)));
                  const to = Math.min(visibleDays, Math.max(from + 1, diffDays(start, parseISODate(reservation.checkOut))));
                  const tone = reservation.status === "CHECKED_IN" ? "bg-[#0d8a70] text-white" : reservation.status === "PENDING" ? "bg-[#f1b43f] text-white" : reservation.channel === "booking" ? "bg-[#6398e9] text-white" : "bg-[#e3f1ec] text-[#167862]";
                  return <button key={reservation.id} type="button" onClick={() => props.onOpen(reservation.id)} className={cn("absolute top-2.5 z-10 h-9 truncate rounded-lg px-2 text-[9px] font-extrabold shadow-sm", tone)} style={{ left: ROOM_COLUMN + from * DAY_COLUMN + 3, width: Math.max(DAY_COLUMN - 6, (to - from) * DAY_COLUMN - 6) }}>{reservation.channel === "direct" ? reservation.guestName : `${reservation.channel === "booking" ? "Booking" : reservation.channel} · ${Math.max(1, to - from)}д`}</button>;
                })}
              </div>;
            }) : <div className="p-8 text-center text-xs text-[#969c95]">{copy.empty}</div>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => props.onCreate()} className="sh-mobile-primary flex min-h-11 flex-1 items-center justify-center gap-2"><Plus className="size-4" />{copy.newBooking}</button>
        <button type="button" onClick={props.onExpand} className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#dfe3da] bg-white text-[#087e67] shadow-sm" aria-label={props.locale === "kk" ? "Күнтізбені кеңейту" : "Развернуть календарь"}><Maximize2 className="size-5" /></button>
      </div>
    </div>
  );
}
