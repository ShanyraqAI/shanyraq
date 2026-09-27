"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronDown, ChevronLeft, Plus } from "lucide-react";
import { addDays, diffDays, formatISOCompactDate, parseISODate, toISODate, weekdayShort } from "@/lib/dates";
import type { ReservationVM, RoomVM } from "@/lib/types";
import { mobileCopy, type AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

interface Props {
  locale: AppLocale;
  anchorISO: string;
  todayISO: string;
  viewportWidth: number;
  rooms: RoomVM[];
  reservations: ReservationVM[];
  navigating: boolean;
  onShift: (days: number) => void;
  onToday: () => void;
  onOpen: (reservationId: string) => void;
  onCreate: (roomId?: string, date?: string) => void;
  onExpand: () => void;
}

export function MobileCalendar(props: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const copy = mobileCopy[props.locale].calendar;
  const start = parseISODate(props.anchorISO);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const end = days[6];
  const period = `${formatISOCompactDate(props.anchorISO)}–${formatISOCompactDate(toISODate(end))}`;

  return (
    <div className="space-y-4 pb-2">
      <header className="flex items-start justify-between gap-3"><div><h1 className="sh-mobile-title">{copy.title}</h1><p className="sh-mobile-eyebrow">{props.locale === "kk" ? `${props.rooms.length} юнит` : `${props.rooms.length} юнитов`}</p></div><Link href="/dashboard/reservations/new" className="grid size-10 place-items-center rounded-full bg-[#07866b] text-white shadow-md" aria-label={copy.newBooking}><Plus className="size-5" /></Link></header>

      <div className="grid grid-cols-[1fr_1fr_auto] rounded-2xl bg-white p-1 shadow-sm ring-1 ring-[#e7e9e1]">
        <button type="button" className="min-h-10 rounded-xl bg-[#07866b] text-xs font-bold text-white">{props.locale === "kk" ? "Апта" : "Неделя"}</button>
        <button type="button" onClick={props.onExpand} className="min-h-10 rounded-xl text-xs font-bold text-[#7d847d]">{props.locale === "kk" ? "Ай" : "Месяц"}</button>
        <Link href="/dashboard/reservations/filters" className="flex min-h-10 items-center gap-1 rounded-xl px-3 text-[11px] font-bold text-[#727972]">{props.locale === "kk" ? "Сүзгілер" : "Фильтры"}<ChevronDown className="size-3" /></Link>
      </div>

      <div className="flex items-center justify-between"><button type="button" disabled={props.navigating} onClick={() => props.onShift(-7)} className="grid size-8 place-items-center rounded-full text-[#7c837c]"><ChevronLeft className="size-4" /></button><button type="button" onClick={props.onToday} className="text-sm font-extrabold text-[#2d3a34]">{period}</button><button type="button" disabled={props.navigating} onClick={() => props.onShift(7)} className="text-[11px] font-bold text-[#07866b]">{props.locale === "kk" ? "Бүгін" : "Сегодня"}</button></div>

      <div
        className="sh-mobile-card overflow-hidden"
        onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
        onTouchEnd={(event) => { const point = touchStart.current; touchStart.current = null; if (!point) return; const dx = event.changedTouches[0].clientX - point.x; const dy = event.changedTouches[0].clientY - point.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) props.onShift(dx < 0 ? 7 : -7); }}
      >
        <div className="grid grid-cols-[76px_repeat(7,minmax(0,1fr))] border-b border-[#eceee7] bg-[#fafaf7]">
          <div />
          {days.map((day) => { const iso = toISODate(day); return <div key={iso} className={cn("flex h-12 flex-col items-center justify-center text-[9px] text-[#979d96]", iso === props.todayISO && "text-[#07866b]")}><span className="uppercase">{weekdayShort(day)}</span><span className={cn("mt-0.5 grid size-6 place-items-center rounded-full text-[11px] font-extrabold", iso === props.todayISO && "bg-[#07866b] text-white")}>{day.getUTCDate()}</span></div>; })}
        </div>
        {props.rooms.length ? props.rooms.map((room) => {
          const reservation = props.reservations.find((item) => item.roomId === room.id && item.status !== "CANCELLED" && item.status !== "NO_SHOW" && item.checkIn <= toISODate(end) && item.checkOut > props.anchorISO);
          const from = reservation ? Math.max(0, diffDays(start, parseISODate(reservation.checkIn))) : 0;
          const to = reservation ? Math.min(7, Math.max(from + 1, diffDays(start, parseISODate(reservation.checkOut)))) : 0;
          const tone = reservation?.status === "CHECKED_IN" ? "bg-[#0d8a70] text-white" : reservation?.status === "PENDING" ? "bg-[#f1b43f] text-white" : reservation?.channel === "booking" ? "bg-[#6398e9] text-white" : "bg-[#e3f1ec] text-[#167862]";
          return <div key={room.id} className="relative grid min-h-[58px] grid-cols-[76px_repeat(7,minmax(0,1fr))] border-b border-[#eceee7] last:border-0"><div className="flex flex-col justify-center border-r border-[#eceee7] px-2"><span className="truncate text-xs font-extrabold text-[#334039]">{room.number}</span><span className="truncate text-[8px] text-[#a0a59f]">{room.roomTypeName}</span></div>{days.map((day) => <button key={toISODate(day)} type="button" aria-label={`${copy.newBooking}, ${room.number}`} onClick={() => props.onCreate(room.id, toISODate(day))} className="border-r border-[#f0f1eb] last:border-0" />)}{reservation ? <button type="button" onClick={() => props.onOpen(reservation.id)} className={cn("absolute top-2.5 z-10 h-9 truncate rounded-lg px-2 text-[9px] font-extrabold shadow-sm", tone)} style={{ left: `calc(76px + (100% - 76px) * ${from} / 7 + 3px)`, width: `calc((100% - 76px) * ${Math.max(1, to - from)} / 7 - 6px)` }}>{reservation.channel === "direct" ? reservation.guestName : `${reservation.channel === "booking" ? "Booking" : reservation.channel} · ${Math.max(1, to - from)}д`}</button> : null}</div>;
        }) : <div className="p-8 text-center text-xs text-[#969c95]">{copy.empty}</div>}
      </div>

      <div className="sh-mobile-card flex items-center justify-around px-3 py-3 text-[9px] font-semibold text-[#788078]"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#0d8a70]" />{props.locale === "kk" ? "Бос" : "Свободно"}</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#ef6a64]" />{props.locale === "kk" ? "Тәуекел" : "Риск"}</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#f1b43f]" />Hold</span></div>
    </div>
  );
}
