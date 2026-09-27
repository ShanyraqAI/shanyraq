"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calendarStayPosition } from "@/lib/reservations/calendar-range";
import { addDays, formatISOCompactDate, parseISODate, toISODate, weekdayShort } from "@/lib/dates";
import type { ReservationVM, RoomVM } from "@/lib/types";
import { cn } from "@/lib/utils";
import { mobileCopy, type AppLocale } from "@/lib/locale";

const statusColors: Record<string, string> = {
  PENDING: "border-sky-300 bg-sky-100 text-sky-950",
  CONFIRMED: "border-amber-300 bg-amber-100 text-amber-950",
  CHECKED_IN: "border-emerald-400 bg-emerald-100 text-emerald-950",
  CHECKED_OUT: "border-slate-300 bg-slate-100 text-slate-700",
};

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
  const copy = mobileCopy[props.locale].calendar;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dayCount = props.viewportWidth < 350 ? 2 : props.viewportWidth < 410 ? 3 : 4;
  const roomWidth = 74;
  const dayWidth = Math.max(60, (props.viewportWidth - 32 - roomWidth - 2) / dayCount);
  const start = parseISODate(props.anchorISO);
  const days = Array.from({ length: dayCount }, (_, index) => addDays(start, index));
  const end = days.at(-1) ?? start;
  const label = `${formatISOCompactDate(props.anchorISO)}–${formatISOCompactDate(toISODate(end))}`;

  return <div className="space-y-3 pb-24">
    <div className="flex items-center justify-between gap-2"><div><h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1><p className="text-xs text-muted-foreground">{copy.subtitle(props.rooms.length)}</p></div><Button size="sm" onClick={() => props.onCreate()}><Plus className="size-4" /> {copy.booking}</Button></div>
    <div className="flex items-center justify-between rounded-xl border bg-card p-1.5"><Button variant="ghost" size="icon" aria-label={copy.previous} disabled={props.navigating} onClick={() => props.onShift(-dayCount)}><ChevronLeft className="size-5" /></Button><button type="button" onClick={props.onToday} className="min-h-10 flex-1 text-sm font-semibold tabular-nums">{label}</button><Button variant="ghost" size="icon" aria-label={copy.next} disabled={props.navigating} onClick={() => props.onShift(dayCount)}><ChevronRight className="size-5" /></Button></div>
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm" onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={(event) => { const start = touchStart.current; touchStart.current = null; if (!start) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) props.onShift(dx < 0 ? dayCount : -dayCount); }}>
      <div className="flex h-12 border-b bg-secondary"><div className="flex shrink-0 items-center border-r px-2 text-xs font-semibold text-muted-foreground" style={{ width: roomWidth }}>{copy.unit}</div>{days.map((day) => { const iso = toISODate(day); return <div key={iso} className={cn("flex shrink-0 flex-col items-center justify-center border-r text-xs last:border-r-0", iso === props.todayISO && "bg-primary/10 text-primary")} style={{ width: dayWidth }}><span className="text-[10px] uppercase text-muted-foreground">{weekdayShort(day)}</span><span className="font-semibold tabular-nums">{day.getUTCDate()}</span></div>; })}</div>
      {props.rooms.length ? props.rooms.map((room) => <div key={room.id} className="flex h-14 border-b last:border-b-0"><div className="flex shrink-0 flex-col justify-center border-r bg-card px-2" style={{ width: roomWidth }}><span className="truncate text-sm font-semibold">{room.number}</span><span className="truncate text-[10px] text-muted-foreground">{room.roomTypeName}</span></div><div className="relative flex" style={{ width: dayWidth * dayCount }}>{days.map((day) => { const iso = toISODate(day); return <button key={iso} type="button" aria-label={`Новая бронь, номер ${room.number}, ${iso}`} onClick={() => props.onCreate(room.id, iso)} className={cn("h-full shrink-0 border-r border-border/70 last:border-r-0 active:bg-accent", iso === props.todayISO && "bg-primary/[0.04]")} style={{ width: dayWidth }} />; })}{props.reservations.filter((reservation) => reservation.roomId === room.id && reservation.status !== "CANCELLED" && reservation.status !== "NO_SHOW").map((reservation) => { const position = calendarStayPosition(reservation.checkIn, reservation.checkOut, start, dayCount, dayWidth, 4); return position ? <button key={reservation.id} type="button" onClick={() => props.onOpen(reservation.id)} style={{ left: position.left, width: position.width }} className={cn("absolute top-2 z-10 flex h-10 items-center overflow-hidden rounded-md border px-2 text-left text-xs font-semibold shadow-sm", statusColors[reservation.status] ?? statusColors.CONFIRMED)} aria-label={`${reservation.guestName}, номер ${room.number}, ${reservation.checkIn}–${reservation.checkOut}`}><span className="truncate">{reservation.guestName}</span></button> : null; })}</div></div>) : <p className="p-6 text-center text-sm text-muted-foreground">Номеров пока нет.</p>}
    </div>
    <p className="px-1 text-xs text-muted-foreground">{copy.hint}</p>
    <div className="pointer-events-none fixed right-4 z-40" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}><Button className="pointer-events-auto min-h-12 rounded-full px-5 shadow-lg" onClick={props.onExpand}><Maximize2 className="size-4" />{copy.expand}</Button></div>
  </div>;
}
