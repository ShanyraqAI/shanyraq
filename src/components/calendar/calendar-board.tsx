"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { clipStay, staysOverlap } from "@/lib/reservations/calendar-range";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/page-header";
import { ReservationDetailsDialog } from "@/components/reservations/reservation-details-dialog";
import { ReservationFormDialog } from "@/components/reservations/reservation-form-dialog";
import { ReservationImportDialog } from "@/components/calendar/reservation-import-dialog";
import { moveReservationAction } from "@/server/actions/reservations";
import type { CalendarBoardData, CalendarViewMode } from "./types";
import type { ReservationVM } from "@/lib/types";
import { t, channelLabel } from "@/lib/i18n";
import {
  addDays,
  addMonths,
  diffDays,
  eachDay,
  endOfMonth,
  formatShortDate,
  formatMonthYear,
  isSameDay,
  parseISODate,
  startOfMonth,
  toISODate,
  today as getToday,
  weekdayShort,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

const LABEL_W = 148;
const DAY_W: Record<CalendarViewMode, number> = { day: 260, week: 136, month: 52 };

const CHANNEL_BLOCK_STYLES: Record<string, string> = {
  booking: "bg-sky-100/90 text-sky-900 border-sky-300",
  ostrovok: "bg-orange-100/90 text-orange-900 border-orange-300",
  krisha: "bg-cyan-100/90 text-cyan-900 border-cyan-300",
  direct: "bg-emerald-100/90 text-emerald-900 border-emerald-300",
};

export function CalendarBoard(data: CalendarBoardData & { initialView?: CalendarViewMode }) {
  const { rooms, reservations, ratePlans, guests, hotelCurrency } = data;
  const [view, setView] = useState<CalendarViewMode>(data.initialView ?? "week");
  const [anchorISO, setAnchorISO] = useState(() => toISODate(getToday()));
  const [filters, setFilters] = useState({ roomTypeId: "all", channelId: "all", statusId: "all" });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<ReservationVM | null>(null);
  const [createState, setCreateState] = useState<{
    open: boolean;
    roomId?: string;
    date?: string;
  }>({ open: false });
  const [movingId, setMovingId] = useState<string | null>(null);
  const movePending = useRef(false);
  const router = useRouter();

  const anchor = parseISODate(anchorISO);
  const today = getToday();

  const range = useMemo(() => {
    if (view === "day") return { start: anchor, days: 1 };
    if (view === "week") {
      // The selected date is always the first column. It keeps "Сегодня" at
      // the very start of the timetable instead of hiding it mid-week.
      return { start: anchor, days: 7 };
    }
    return {
      start: startOfMonth(anchor),
      days: diffDays(startOfMonth(anchor), addDays(endOfMonth(anchor), 1)),
    };
  }, [anchor, view]);

  const days = useMemo(() => eachDay(range.start, addDays(range.start, range.days)), [range]);
  const dayWidth = DAY_W[view];

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

  function blocksForRoom(roomId: string) {
    const out: {
      res: ReservationVM;
      left: number;
      width: number;
      clippedStart: boolean;
    }[] = [];
    for (const r of visibleReservations) {
      if (r.roomId !== roomId) continue;
      const clipped = clipStay(r.checkIn, r.checkOut, range.start, range.days);
      if (!clipped) continue;
      out.push({
        res: r,
        left: clipped.start * dayWidth,
        width: (clipped.end - clipped.start) * dayWidth - 4,
        clippedStart: clipped.clippedStart,
      });
    }
    return out;
  }

  function shift(dir: 1 | -1) {
    if (view === "day") setAnchorISO(toISODate(addDays(anchor, dir)));
    else if (view === "week") setAnchorISO(toISODate(addDays(anchor, 7 * dir)));
    else setAnchorISO(toISODate(addMonths(anchor, dir)));
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
  const channelOptions = ["booking", "ostrovok", "krisha", "direct"];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-1)}
            aria-label={view === "month" ? "Предыдущий месяц" : view === "week" ? "Предыдущая неделя" : "Предыдущий день"}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchorISO(toISODate(today))}>
            {t.common.today}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(1)}
            aria-label={view === "month" ? "Следующий месяц" : view === "week" ? "Следующая неделя" : "Следующий день"}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <span className="sr-only">Выбрать дату</span>
          <input
            type="date"
            value={anchorISO}
            onChange={(event) => event.target.value && setAnchorISO(event.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm font-medium shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <span className="hidden sm:inline">
            {view === "month"
              ? formatMonthYear(range.start)
              : view === "week"
                ? `${formatShortDate(range.start)} — ${formatShortDate(addDays(range.start, 6))}`
                : formatShortDate(range.start)}
          </span>
        </label>

        <Tabs value={view} onValueChange={(v) => setView(v as CalendarViewMode)}>
          <TabsList className="ml-2">
            <TabsTrigger value="day">{t.calendar.day}</TabsTrigger>
            <TabsTrigger value="week">{t.calendar.week}</TabsTrigger>
            <TabsTrigger value="month">{t.calendar.month}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={filters.roomTypeId}
            onValueChange={(v) => setFilters((f) => ({ ...f, roomTypeId: v }))}
          >
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder={t.filters.roomType} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.filters.allTypes}</SelectItem>
              {roomTypeOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.channelId}
            onValueChange={(v) => setFilters((f) => ({ ...f, channelId: v }))}
          >
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder={t.filters.channel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.filters.allChannels}</SelectItem>
              {channelOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {channelLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.statusId}
            onValueChange={(v) => setFilters((f) => ({ ...f, statusId: v }))}
          >
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder={t.filters.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.filters.allStatuses}</SelectItem>
              {["PENDING", "CONFIRMED", "CHECKED_IN"].map((s) => (
                <SelectItem key={s} value={s}>
                  {t.statuses.reservation[s as keyof typeof t.statuses.reservation]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setCreateState({ open: true })}>
            <Plus className="mr-1.5 size-4" /> {t.calendar.newReservation}
          </Button>
          <ReservationImportDialog />
        </div>
      </div>

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
          <div className="overflow-x-auto">
            <div style={{ minWidth: LABEL_W + range.days * dayWidth }}>
              {/* Day header */}
              <div className="flex h-12 border-b bg-secondary/60">
                <div
                  className="sticky left-0 z-20 flex shrink-0 items-end bg-secondary/95 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  style={{ width: LABEL_W }}
                >
                  {t.calendar.roomsCount(rooms.length)}
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
                          isToday && "bg-accent",
                          view !== "month" && "gap-0.5 py-1.5",
                        )}
                      >
                        {view !== "month" && (
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {weekdayShort(d)}
                          </span>
                        )}
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
                    className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r bg-card px-3"
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
                              isToday && "bg-accent/40",
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* reservation blocks */}
                    {blocksForRoom(room.id).map(({ res, left, width }) => (
                      <button
                        key={`${res.id}-${left}`}
                        type="button"
                        disabled={movingId === res.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(res);
                          setDetailsOpen(true);
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
          onOpenChange={setDetailsOpen}
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
            checkIn: createState.date,
            checkOut: createState.date
              ? addDays(parseISODate(createState.date), 1).toISOString().slice(0, 10)
              : undefined,
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
