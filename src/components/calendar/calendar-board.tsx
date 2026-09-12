"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import {
  calendarTimelineRange,
  clipStay,
  shiftCalendarAnchor,
  staysOverlap,
  type CalendarRangeDays,
} from "@/lib/reservations/calendar-range";
import { findSelectedReservation } from "@/lib/reservations/calendar-selection";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarPlus,
  Loader2,
} from "lucide-react";
import { EmptyState } from "@/components/shared/page-header";
import { ReservationDetailsDialog } from "@/components/reservations/reservation-details-dialog";
import { ReservationFormDialog } from "@/components/reservations/reservation-form-dialog";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { moveReservationAction } from "@/server/actions/reservations";
import type { CalendarBoardData, CalendarFilters } from "./types";
import type { ReservationVM } from "@/lib/types";
import { t, channelLabel } from "@/lib/i18n";
import {
  addDays,
  diffDays,
  eachDay,
  formatMonthYear,
  isSameDay,
  parseISODate,
  toISODate,
  weekdayShort,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

const LABEL_W = 136;
const DAY_W: Record<CalendarRangeDays, number> = { 7: 136, 14: 84, 30: 52 };

const CHANNEL_BLOCK_STYLES: Record<string, string> = {
  booking: "bg-sky-100/90 text-sky-900 border-sky-300",
  ostrovok: "bg-orange-100/90 text-orange-900 border-orange-300",
  krisha: "bg-cyan-100/90 text-cyan-900 border-cyan-300",
  direct: "bg-emerald-100/90 text-emerald-900 border-emerald-300",
};

interface ReservationBlock {
  res: ReservationVM;
  left: number;
  width: number;
}

export function CalendarBoard(data: CalendarBoardData & { rangeDays: CalendarRangeDays; initialAnchor?: string }) {
  const { rooms, reservations, ratePlans, guests, hotelCurrency } = data;
  const anchorISO = data.initialAnchor ?? data.todayISO;
  const rangeDays = data.rangeDays;
  const [filters, setFilters] = useState<CalendarFilters>({ roomTypeId: "all", channelId: "all", statusId: "all" });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createState, setCreateState] = useState<{
    open: boolean;
    roomId?: string;
    date?: string;
  }>({ open: false });
  const [movingId, setMovingId] = useState<string | null>(null);
  const [navigating, startNavigation] = useTransition();
  const movePending = useRef(false);
  const router = useRouter();

  const today = parseISODate(data.todayISO);
  const range = useMemo(() => calendarTimelineRange(anchorISO, rangeDays), [anchorISO, rangeDays]);
  const selected = findSelectedReservation(reservations, selectedId);

  const days = useMemo(() => eachDay(range.start, range.endExclusive), [range.start, range.endExclusive]);
  const dayWidth = DAY_W[rangeDays];

  const visibleReservations = useMemo(
    () =>
      reservations.filter((r) => {
        if (r.status === "CANCELLED") return false; // keep the board clean
        if (filters.roomTypeId !== "all" && r.roomTypeId !== filters.roomTypeId) return false;
        if (filters.channelId !== "all" && r.channel !== filters.channelId) return false;
        if (filters.statusId !== "all" && r.status !== filters.statusId) return false;
        return true;
      }),
    [reservations, filters],
  );

  const blocksByRoom = useMemo(() => {
    const grouped = new Map<string, ReservationBlock[]>();
    for (const r of visibleReservations) {
      const clipped = clipStay(r.checkIn, r.checkOut, range.start, range.days);
      if (!clipped) continue;
      const blocks = grouped.get(r.roomId) ?? [];
      blocks.push({
        res: r,
        left: clipped.start * dayWidth,
        width: (clipped.end - clipped.start) * dayWidth - 4,
      });
      grouped.set(r.roomId, blocks);
    }
    return grouped;
  }, [dayWidth, range.days, range.start, visibleReservations]);

  const monthSegments = useMemo(() => {
    const segments: Array<{ key: string; label: string; days: number }> = [];
    for (const day of days) {
      const key = `${day.getUTCFullYear()}-${day.getUTCMonth()}`;
      const current = segments.at(-1);
      if (current?.key === key) current.days++;
      else segments.push({ key, label: formatMonthYear(day), days: 1 });
    }
    return segments;
  }, [days]);

  function navigate(nextAnchor: string, nextRange: CalendarRangeDays = rangeDays) {
    const query = new URLSearchParams({ date: nextAnchor, range: String(nextRange) });
    startNavigation(() => router.push(`/dashboard/calendar?${query.toString()}`, { scroll: false }));
  }

  function shift(dir: 1 | -1) {
    navigate(shiftCalendarAnchor(anchorISO, rangeDays, dir));
  }

  async function handleDrop(reservationId: string, roomId: string, dateISO: string) {
    if (movePending.current) return;
    // Quick move: drop onto an empty cell → move room + keep nights, anchored at dropped date.
    const res = reservations.find((r) => r.id === reservationId);
    if (!res || !ACTIVE_RESERVATION_STATUSES.includes(res.status)) return;
    const nights = diffDays(parseISODate(res.checkIn), parseISODate(res.checkOut));
    const checkOut = toISODate(addDays(parseISODate(dateISO), nights));
    // Use all reservations: hidden channels/status filters must never free a room.
    if (reservations.some((other) => other.id !== res.id && other.roomId === roomId &&
      ACTIVE_RESERVATION_STATUSES.includes(other.status) && staysOverlap(dateISO, checkOut, other.checkIn, other.checkOut))) {
      toast.error("В этом номере уже есть бронь на выбранные даты.");
      return;
    }
    movePending.current = true;
    setMovingId(reservationId);
    try {
      const result = await moveReservationAction(
        reservationId,
        roomId,
        dateISO,
        checkOut,
      );
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message ?? t.calendar.movedToast);
      router.refresh();
    } catch {
      toast.error("Не удалось подтвердить перенос. Обновите календарь перед повторной попыткой.");
      router.refresh();
    } finally {
      movePending.current = false;
      setMovingId(null);
    }
  }

  const roomTypeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rooms) seen.set(r.roomTypeId, r.roomTypeName);
    return Array.from(seen.entries());
  }, [rooms]);
  return (
    <div className="space-y-4">
      <CalendarToolbar
        anchorISO={anchorISO}
        rangeDays={rangeDays}
        todayISO={data.todayISO}
        filters={filters}
        roomTypeOptions={roomTypeOptions}
        navigating={navigating}
        onNavigate={navigate}
        onShift={shift}
        onFiltersChange={setFilters}
        onCreate={() => setCreateState({ open: true })}
      />

      {/* Board */}
      {rooms.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title={t.calendar.noRoomsTitle}
          description={t.calendar.noRoomsDescription}
          action={
            <Link href="/dashboard/rooms" className="text-sm font-medium text-primary hover:underline">
              {t.calendar.goToRooms}
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto overscroll-x-contain">
            <div style={{ minWidth: LABEL_W + range.days * dayWidth }}>
              {/* Compact month orientation */}
              <div className="flex h-7 border-b bg-secondary/50">
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-secondary px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  style={{ width: LABEL_W }}
                >
                  Период
                </div>
                <div className="flex">
                  {monthSegments.map((segment) => (
                    <div
                      key={segment.key}
                      style={{ width: segment.days * dayWidth }}
                      className="relative shrink-0 border-r py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0"
                    >
                      <span className="sticky left-36 block w-fit whitespace-nowrap px-2">
                        {segment.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Day header */}
              <div className="flex h-12 border-b bg-secondary/60">
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-end border-r bg-secondary px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  style={{ width: LABEL_W }}
                >
                  Номер
                </div>
                <div className="flex">
                  {days.map((d) => {
                    const isToday = isSameDay(d, today);
                    return (
                      <div
                        key={d.toISOString()}
                        style={{ width: dayWidth }}
                        className={cn(
                          "flex shrink-0 flex-col items-center justify-center border-l first:border-l-0",
                          isToday && "bg-primary/10",
                          "gap-0.5 py-1.5",
                        )}
                      >
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{weekdayShort(d)}</span>
                        <span
                          className={cn(
                            "text-sm tabular-nums",
                            isToday
                              ? "flex size-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                              : "font-medium",
                          )}
                        >
                          {d.getUTCDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actual room rows. Room type remains supporting metadata. */}
              {rooms.map((room) => (
                <div key={room.id} className="relative flex h-[68px] border-b last:border-b-0">
                  <div
                    className="sticky left-0 z-30 flex shrink-0 flex-col justify-center border-r bg-card px-3"
                    style={{ width: LABEL_W }}
                  >
                    <span className="truncate text-sm font-semibold leading-tight" title={room.number}>{room.number}</span>
                    <span className="truncate text-xs text-muted-foreground" title={room.roomTypeName}>{room.roomTypeName}</span>
                  </div>
                  <div className="relative" style={{ width: range.days * dayWidth }}>
                    {/* clickable cells */}
                    <div
                      className="absolute inset-0 grid"
                      style={{ gridTemplateColumns: `repeat(${range.days}, ${dayWidth}px)` }}
                    >
                      {days.map((d) => {
                        const iso = d.toISOString().slice(0, 10);
                        const isToday = isSameDay(d, today);
                        const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                        return (
                          <button
                            key={iso}
                            type="button"
                            aria-label={t.calendar.newReservationCell(room.number, iso)}
                            onClick={() => setCreateState({ open: true, roomId: room.id, date: iso })}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const id = e.dataTransfer.getData("text/plain");
                              if (!id) return;
                              void handleDrop(id, room.id, iso);
                            }}
                            className={cn(
                              "border-l border-border/50 first:border-l-0 hover:bg-accent/60 focus-visible:bg-accent",
                              weekend && !isToday && "bg-secondary/30",
                              isToday && "border-l-2 border-l-primary/40 bg-primary/[0.06]",
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* reservation blocks */}
                    {(blocksByRoom.get(room.id) ?? []).map(({ res, left, width }) => (
                      <button
                        key={`${res.id}-${left}`}
                        type="button"
                        disabled={movingId === res.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(res.id);
                          setDetailsOpen(true);
                        }}
                        onTouchStart={(event) => {
                          event.currentTarget.draggable = false;
                        }}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", res.id)}
                        draggable={!movingId && ACTIVE_RESERVATION_STATUSES.includes(res.status)}
                        style={{ left: left + 2, width }}
                        className={cn(
                          "absolute top-[9px] z-10 flex h-[50px] cursor-pointer flex-col justify-center overflow-hidden rounded-md border px-2 text-left shadow-sm transition-all hover:z-20 hover:shadow-md",
                          CHANNEL_BLOCK_STYLES[res.channel] ?? CHANNEL_BLOCK_STYLES.direct,
                          movingId === res.id && "opacity-50",
                        )}
                      >
                        <span className="truncate text-xs font-semibold leading-tight">
                          {res.guestName}
                          {res.status === "PENDING" ? ` ${t.calendar.pendingSuffix}` : ""}
                        </span>
                        {width >= 110 ? (
                          <>
                            <span className="truncate text-[11px] leading-tight opacity-75">
                              {channelLabel(res.channel)}
                            </span>
                            <span className="text-[10px] font-medium tabular-nums opacity-80">
                              {res.checkIn.slice(8)} → {res.checkOut.slice(8)}
                            </span>
                          </>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t.calendar.tip}
      </p>

      {/* Details */}
      {selected && (
        <ReservationDetailsDialog
          reservation={selected}
          rooms={rooms}
          ratePlans={ratePlans}
          guests={guests}
          hotelCurrency={hotelCurrency}
          open={detailsOpen}
          onOpenChange={(open) => {
            setDetailsOpen(open);
            if (!open) setSelectedId(null);
          }}
        />
      )}

      {/* Create */}
      {createState.open && (
        <ReservationFormDialog
          mode="create"
          open={createState.open}
          onOpenChange={(o) => setCreateState((s) => ({ ...s, open: o }))}
          rooms={rooms}
          ratePlans={ratePlans}
          guests={guests}
          hotelCurrency={hotelCurrency}
          initial={{
            roomId: createState.roomId,
            checkIn: createState.date ?? data.todayISO,
            checkOut: toISODate(addDays(parseISODate(createState.date ?? data.todayISO), 1)),
          }}
        />
      )}
    </div>
  );
}

export function CalendarBoardSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {t.calendar.loadingBoard}
    </div>
  );
}

export function formatRangeShort(a: string, b: string): string {
  return `${a.slice(8)} → ${b.slice(8)}`;
}
