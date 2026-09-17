"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, ChevronDown, ChevronRight, Clock3, Loader2, StickyNote } from "lucide-react";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { reservationMatchesCalendarSearch } from "@/lib/reservations/calendar-search";
import { calendarStayPosition, calendarTimelineRange, shiftCalendarAnchor, staysOverlap, type CalendarRangeDays } from "@/lib/reservations/calendar-range";
import { buildTurnaroundMap, suggestQuickBookingSlot, turnaroundMessage } from "@/lib/reservations/calendar-turnaround";
import { findSelectedReservation } from "@/lib/reservations/calendar-selection";
import { EmptyState } from "@/components/shared/page-header";
import { ReservationDetailsDialog } from "@/components/reservations/reservation-details-dialog";
import { ReservationFormDialog } from "@/components/reservations/reservation-form-dialog";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { moveReservationAction } from "@/server/actions/reservations";
import { saveCalendarPreferencesAction } from "@/server/actions/calendar";
import type { CalendarBoardData, CalendarFilters, CalendarPreferences } from "./types";
import { reservationDisplayId, type ReservationVM, type RoomVM } from "@/lib/types";
import { channelLabel, t } from "@/lib/i18n";
import { addDays, diffDays, eachDay, formatISOCompactDate, formatISODate, formatMonthYear, isSameDay, parseISODate, toISODate, weekdayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

const LABEL_W = 176;
const DAY_W: Record<CalendarRangeDays, number> = { 7: 136, 14: 84, 30: 52 };

const RESERVATION_STYLES: Record<string, { bar: string; dot: string; label: string; legend: string }> = {
  PENDING: {
    bar: "border-amber-300 bg-amber-50 text-amber-950 before:bg-amber-500 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100",
    dot: "bg-amber-500",
    label: "Ожидает",
    legend: "border-amber-200 bg-amber-50 text-amber-900",
  },
  CONFIRMED: {
    bar: "border-[#a7bea8] bg-[#e5efe4] text-[#254c35] before:bg-[#5f825f] dark:border-[#607763] dark:bg-[#294235] dark:text-[#edf5ee]",
    dot: "bg-[#5f825f]",
    label: "Подтверждена",
    legend: "border-[#cbdac8] bg-[#edf4eb] text-[#355a3d]",
  },
  CHECKED_IN: {
    bar: "border-[#83aaa2] bg-[#dcece8] text-[#11473d] before:bg-[#21675a] dark:border-[#65978d] dark:bg-[#244f47] dark:text-white",
    dot: "bg-[#21675a]",
    label: "Заселён",
    legend: "border-[#bdd6d0] bg-[#e7f2ef] text-[#175247]",
  },
};

const ROOM_STATUS: Record<string, { label: string; dot: string }> = {
  AVAILABLE: { label: "Чисто и свободно", dot: "bg-emerald-500" },
  OCCUPIED: { label: "Занято", dot: "bg-blue-500" },
  CLEANING: { label: "Требуется уборка", dot: "bg-amber-500" },
  MAINTENANCE: { label: "На обслуживании", dot: "bg-orange-500" },
  OUT_OF_ORDER: { label: "Вне сервиса", dot: "bg-zinc-400" },
};

const DENSITY = {
  COMFORTABLE: { row: 68, block: 56, top: 6 },
  STANDARD: { row: 56, block: 46, top: 5 },
  COMPACT: { row: 44, block: 36, top: 4 },
} as const;

interface ReservationBlock {
  res: ReservationVM;
  left: number;
  width: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

interface RoomGroup {
  id: string;
  name: string;
  rooms: RoomVM[];
}

interface CreateReservationState {
  open: boolean;
  roomId?: string;
  date?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  contextNote?: string;
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export function CalendarBoard(data: CalendarBoardData & { rangeDays: CalendarRangeDays; initialAnchor?: string }) {
  const { rooms, reservations, ratePlans, guests, hotelCurrency } = data;
  const anchorISO = data.initialAnchor ?? data.todayISO;
  const rangeDays = data.rangeDays;
  const [filters, setFilters] = useState<CalendarFilters>({ roomTypeId: "all", channelId: "all", statusId: "all" });
  const [preferences, setPreferences] = useState(data.initialPreferences);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createState, setCreateState] = useState<CreateReservationState>({ open: false });
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ roomId: string; date: string } | null>(null);
  const [navigating, startNavigation] = useTransition();
  const [savingPreferences, startPreferenceSave] = useTransition();
  const router = useRouter();

  const today = parseISODate(data.todayISO);
  const range = useMemo(() => calendarTimelineRange(anchorISO, rangeDays), [anchorISO, rangeDays]);
  const days = useMemo(() => eachDay(range.start, range.endExclusive), [range.start, range.endExclusive]);
  const dayWidth = DAY_W[rangeDays];
  const density = DENSITY[preferences.density];
  const selected = findSelectedReservation(reservations, selectedId);
  const normalizedSearch = normalizeSearch(deferredSearch);
  const activeStays = useMemo(
    () => reservations.filter((reservation) => ACTIVE_RESERVATION_STATUSES.includes(reservation.status)),
    [reservations],
  );
  const turnaroundByReservation = useMemo(
    () => buildTurnaroundMap(reservations.filter((reservation) => !["CANCELLED", "NO_SHOW"].includes(reservation.status))),
    [reservations],
  );
  const dropIsAvailable = useMemo(() => {
    if (!draggingId || !dropTarget) return true;
    const dragged = reservations.find((reservation) => reservation.id === draggingId);
    if (!dragged) return false;
    const nights = diffDays(parseISODate(dragged.checkIn), parseISODate(dragged.checkOut));
    const targetCheckOut = toISODate(addDays(parseISODate(dropTarget.date), nights));
    return !activeStays.some((reservation) => reservation.id !== dragged.id && reservation.roomId === dropTarget.roomId && staysOverlap(dropTarget.date, targetCheckOut, reservation.checkIn, reservation.checkOut));
  }, [activeStays, draggingId, dropTarget, reservations]);

  const filteredReservations = useMemo(() => reservations.filter((reservation) => {
    if (reservation.status === "CANCELLED") return false;
    if (filters.roomTypeId !== "all" && reservation.roomTypeId !== filters.roomTypeId) return false;
    if (filters.channelId !== "all" && reservation.channel !== filters.channelId) return false;
    if (filters.statusId !== "all" && reservation.status !== filters.statusId) return false;
    return true;
  }), [reservations, filters]);

  const matchingReservationIds = useMemo(() => new Set(
    filteredReservations.filter((reservation) => reservationMatchesCalendarSearch(reservation, normalizedSearch)).map((reservation) => reservation.id),
  ), [filteredReservations, normalizedSearch]);

  const visibleRooms = useMemo(() => rooms.filter((room) => {
    if (filters.roomTypeId !== "all" && room.roomTypeId !== filters.roomTypeId) return false;
    if (!normalizedSearch) return true;
    const roomMatches = [room.number, room.roomTypeName, ROOM_STATUS[room.status]?.label]
      .some((value) => value?.toLocaleLowerCase("ru-RU").includes(normalizedSearch));
    return roomMatches || filteredReservations.some((reservation) => reservation.roomId === room.id && matchingReservationIds.has(reservation.id));
  }), [filteredReservations, filters.roomTypeId, matchingReservationIds, normalizedSearch, rooms]);

  const visibleReservations = useMemo(() => {
    if (!normalizedSearch) return filteredReservations;
    const directRoomMatches = new Set(visibleRooms.filter((room) => [room.number, room.roomTypeName].some((value) => value.toLocaleLowerCase("ru-RU").includes(normalizedSearch))).map((room) => room.id));
    return filteredReservations.filter((reservation) => matchingReservationIds.has(reservation.id) || directRoomMatches.has(reservation.roomId));
  }, [filteredReservations, matchingReservationIds, normalizedSearch, visibleRooms]);

  const blocksByRoom = useMemo(() => {
    const grouped = new Map<string, ReservationBlock[]>();
    for (const reservation of visibleReservations) {
      const position = calendarStayPosition(reservation.checkIn, reservation.checkOut, range.start, range.days, dayWidth);
      if (!position) continue;
      const blocks = grouped.get(reservation.roomId) ?? [];
      blocks.push({ res: reservation, ...position });
      grouped.set(reservation.roomId, blocks);
    }
    return grouped;
  }, [dayWidth, range.days, range.start, visibleReservations]);

  const roomGroups = useMemo(() => {
    const groups = new Map<string, RoomGroup>();
    for (const room of visibleRooms) {
      const group = groups.get(room.roomTypeId) ?? { id: room.roomTypeId, name: room.roomTypeName, rooms: [] };
      group.rooms.push(room);
      groups.set(room.roomTypeId, group);
    }
    return Array.from(groups.values());
  }, [visibleRooms]);

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

  const todayStats = useMemo(() => ({
    arrivals: reservations.filter((reservation) => reservation.status !== "CANCELLED" && reservation.checkIn === data.todayISO).length,
    departures: reservations.filter((reservation) => reservation.status !== "CANCELLED" && reservation.checkOut === data.todayISO).length,
    staying: reservations.filter((reservation) => reservation.status === "CHECKED_IN").length,
    available: rooms.filter((room) => room.status === "AVAILABLE").length,
  }), [data.todayISO, reservations, rooms]);

  function navigate(nextAnchor: string, nextRange: CalendarRangeDays = rangeDays) {
    const query = new URLSearchParams({ date: nextAnchor, range: String(nextRange) });
    startNavigation(() => router.push(`/dashboard/calendar?${query.toString()}`, { scroll: false }));
  }

  function shift(direction: 1 | -1) {
    navigate(shiftCalendarAnchor(anchorISO, rangeDays, direction));
  }

  function savePreferences(next: CalendarPreferences) {
    const previous = preferences;
    setPreferences(next);
    startPreferenceSave(async () => {
      const result = await saveCalendarPreferencesAction(next);
      if (!result.ok) {
        setPreferences(previous);
        toast.error(result.error);
      }
    });
  }

  function toggleGroup(roomTypeId: string) {
    const collapsed = new Set(preferences.collapsedRoomTypeIds);
    if (collapsed.has(roomTypeId)) collapsed.delete(roomTypeId);
    else collapsed.add(roomTypeId);
    savePreferences({ ...preferences, collapsedRoomTypeIds: Array.from(collapsed) });
  }

  function openQuickBooking(roomId: string, date: string) {
    const slot = suggestQuickBookingSlot(activeStays, roomId, date);
    if (!slot) {
      toast.error("На эту ночь номер уже забронирован.");
      return;
    }
    const gapNotes = [
      slot.minutesAfterPrevious === null ? null : `После предыдущего выезда: ${turnaroundMessage(slot.minutesAfterPrevious)}`,
      slot.minutesBeforeNext === null ? null : `До следующего заезда: ${turnaroundMessage(slot.minutesBeforeNext)}`,
    ].filter((note): note is string => Boolean(note));
    setCreateState({
      open: true,
      roomId,
      date: slot.checkIn,
      checkOut: slot.checkOut,
      checkInTime: slot.checkInTime,
      checkOutTime: slot.checkOutTime,
      contextNote: gapNotes.join(" · "),
    });
  }

  async function undoMove(reservation: ReservationVM) {
    setMovingId(reservation.id);
    try {
      const result = await moveReservationAction(
        reservation.id,
        reservation.roomId,
        reservation.checkIn,
        reservation.checkOut,
      );
      if (!result.ok) toast.error(result.error);
      else toast.success("Перенос брони отменён");
      router.refresh();
    } catch {
      toast.error("Не удалось отменить перенос. Проверьте доступность номера.");
      router.refresh();
    } finally {
      setMovingId(null);
    }
  }

  async function handleDrop(reservationId: string, roomId: string, dateISO: string) {
    if (movingId) return;
    const reservation = reservations.find((item) => item.id === reservationId);
    if (!reservation || !ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) return;
    const nights = diffDays(parseISODate(reservation.checkIn), parseISODate(reservation.checkOut));
    const checkOut = toISODate(addDays(parseISODate(dateISO), nights));
    if (reservations.some((other) => other.id !== reservation.id && other.roomId === roomId && ACTIVE_RESERVATION_STATUSES.includes(other.status) && staysOverlap(dateISO, checkOut, other.checkIn, other.checkOut))) {
      toast.error("В этом номере уже есть бронь на выбранные даты.");
      return;
    }
    setMovingId(reservationId);
    try {
      const result = await moveReservationAction(reservationId, roomId, dateISO, checkOut);
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message ?? t.calendar.movedToast, {
        duration: 8_000,
        action: { label: "Отменить", onClick: () => void undoMove(reservation) },
      });
      router.refresh();
    } catch {
      toast.error("Не удалось подтвердить перенос. Обновите календарь перед повторной попыткой.");
      router.refresh();
    } finally {
      setMovingId(null);
    }
  }

  const roomTypeOptions = useMemo(() => Array.from(new Map(rooms.map((room) => [room.roomTypeId, room.roomTypeName])).entries()), [rooms]);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="space-y-3">
        <CalendarToolbar
          anchorISO={anchorISO}
          rangeDays={rangeDays}
          todayISO={data.todayISO}
          filters={filters}
          preferences={preferences}
          roomTypeOptions={roomTypeOptions}
          navigating={navigating}
          savingPreferences={savingPreferences}
          searchQuery={searchQuery}
          searchResultCount={visibleRooms.length}
          onSearchChange={setSearchQuery}
          onNavigate={navigate}
          onShift={shift}
          onFiltersChange={setFilters}
          onPreferencesChange={savePreferences}
          onCreate={() => setCreateState({ open: true })}
        />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-3.5 py-2 shadow-xs" aria-label="Сводка на сегодня">
          <Metric label="Заезды" value={todayStats.arrivals} />
          <Metric label="Выезды" value={todayStats.departures} />
          <Metric label="Проживают" value={todayStats.staying} />
          <Metric label="Свободно" value={todayStats.available} />
          <span className="ml-auto hidden items-center gap-3 border-l pl-4 text-xs text-muted-foreground lg:flex" aria-label="Статусы бронирований">
            <Legend style={RESERVATION_STYLES.PENDING} />
            <Legend style={RESERVATION_STYLES.CONFIRMED} />
            <Legend style={RESERVATION_STYLES.CHECKED_IN} />
          </span>
        </div>

        {rooms.length === 0 ? (
          <EmptyState icon={CalendarPlus} title={t.calendar.noRoomsTitle} description={t.calendar.noRoomsDescription} action={<Link href="/dashboard/rooms" className="text-sm font-medium text-primary hover:underline">{t.calendar.goToRooms}</Link>} />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="calendar-timeline-scroll overflow-x-auto overscroll-x-contain">
              <div style={{ minWidth: LABEL_W + range.days * dayWidth }}>
                <div className="flex h-7 border-b bg-secondary/40">
                  <div className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-secondary px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ width: LABEL_W }}>Категория / номер</div>
                  <div className="flex">{monthSegments.map((segment) => <div key={segment.key} style={{ width: segment.days * dayWidth }} className="shrink-0 border-r py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0"><span className="sticky left-44 block w-fit whitespace-nowrap px-2">{segment.label}</span></div>)}</div>
                </div>
                <div className="flex h-12 border-b bg-secondary/50">
                  <div className="sticky left-0 z-30 flex shrink-0 items-end border-r bg-secondary px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ width: LABEL_W }}>Номер и статус</div>
                  <div className="flex">{days.map((day) => {
                    const isToday = isSameDay(day, today);
                    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                    return <div key={day.toISOString()} style={{ width: dayWidth }} className={cn("flex shrink-0 flex-col items-center justify-center border-l first:border-l-0", weekend && !isToday && "bg-secondary/40", isToday && "bg-primary/10")}><span className={cn("text-[10px] uppercase tracking-wide text-muted-foreground", isToday && "font-semibold text-primary")}>{isToday ? "Сегодня" : weekdayShort(day)}</span><span className={cn("mt-0.5 text-sm tabular-nums", isToday ? "flex size-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" : "font-medium")}>{day.getUTCDate()}</span></div>;
                  })}</div>
                </div>

                {roomGroups.length === 0 ? (
                  <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">По вашему запросу ничего не найдено.</div>
                ) : roomGroups.map((group) => {
                  const collapsed = preferences.collapsedRoomTypeIds.includes(group.id);
                  return (
                    <div key={group.id}>
                      <button type="button" onClick={() => toggleGroup(group.id)} className="sticky left-0 z-20 flex h-8 w-full items-center border-b border-border/80 bg-secondary/80 px-3 text-left backdrop-blur-sm hover:bg-secondary" aria-expanded={!collapsed}>
                        {collapsed ? <ChevronRight className="mr-1.5 size-3.5" /> : <ChevronDown className="mr-1.5 size-3.5" />}
                        <span className="text-xs font-semibold">{group.name}</span><span className="ml-2 text-[11px] text-muted-foreground">{group.rooms.length} ном.</span>
                      </button>
                      {!collapsed ? group.rooms.map((room) => (
                        <div key={room.id} className="relative flex border-b last:border-b-0" style={{ height: density.row }}>
                          <RoomLabel room={room} />
                          <div className="relative" style={{ width: range.days * dayWidth }}>
                            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${range.days}, ${dayWidth}px)` }}>
                              {days.map((day) => {
                                const iso = day.toISOString().slice(0, 10);
                                const isToday = isSameDay(day, today);
                                const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                                const isDropTarget = dropTarget?.roomId === room.id && dropTarget.date === iso;
                                return (
                                  <button
                                    key={iso}
                                    type="button"
                                    aria-label={t.calendar.newReservationCell(room.number, iso)}
                                    onClick={() => openQuickBooking(room.id, iso)}
                                    onDragEnter={(event) => {
                                      event.preventDefault();
                                      setDropTarget((current) => current?.roomId === room.id && current.date === iso ? current : { roomId: room.id, date: iso });
                                    }}
                                    onDragOver={(event) => {
                                      event.preventDefault();
                                      event.dataTransfer.dropEffect = "move";
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      const id = event.dataTransfer.getData("text/plain");
                                      setDropTarget(null);
                                      setDraggingId(null);
                                      if (id) void handleDrop(id, room.id, iso);
                                    }}
                                    className={cn(
                                      "relative border-l border-border/70 first:border-l-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                                      weekend && !isToday && "bg-secondary/25",
                                      isToday && "border-l-2 border-l-primary/55 bg-primary/[0.06]",
                                      isDropTarget && dropIsAvailable && "z-[5] bg-primary/10 outline-2 -outline-offset-2 outline-primary/60",
                                      isDropTarget && !dropIsAvailable && "z-[5] bg-destructive/10 outline-2 -outline-offset-2 outline-destructive/60",
                                    )}
                                  >
                                    {isDropTarget && draggingId ? <span className={cn("pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded bg-background/90 px-1 py-0.5 text-[9px] font-semibold shadow-sm", dropIsAvailable ? "text-primary" : "text-destructive")}>{dropIsAvailable ? "Перенести" : "Занято"}</span> : null}
                                  </button>
                                );
                              })}
                            </div>
                            {(blocksByRoom.get(room.id) ?? []).map(({ res, left, width, clippedStart, clippedEnd }) => (
                              <ReservationBar
                                key={`${res.id}-${left}`}
                                reservation={res}
                                left={left}
                                width={width}
                                height={density.block}
                                top={density.top}
                                clippedStart={clippedStart}
                                clippedEnd={clippedEnd}
                                moving={movingId === res.id || draggingId === res.id}
                                preferences={preferences}
                                highlighted={Boolean(normalizedSearch && matchingReservationIds.has(res.id))}
                                turnaroundMinutes={turnaroundByReservation.get(res.id)}
                                onDragStart={() => setDraggingId(res.id)}
                                onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                                onOpen={() => { setSelectedId(res.id); setDetailsOpen(true); }}
                              />
                            ))}
                          </div>
                        </div>
                      )) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">Нажмите на свободную ячейку для новой брони. Перетащите бронь на свободный номер или дату — сервер повторно проверит доступность.</p>

        {selected ? <ReservationDetailsDialog reservation={selected} rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotelCurrency} open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setSelectedId(null); }} /> : null}
        {createState.open ? <ReservationFormDialog compact mode="create" open={createState.open} onOpenChange={(open) => setCreateState((state) => ({ ...state, open }))} rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotelCurrency} contextNote={createState.contextNote} initial={{ roomId: createState.roomId, checkIn: createState.date ?? data.todayISO, checkOut: createState.checkOut ?? toISODate(addDays(parseISODate(createState.date ?? data.todayISO), 1)), checkInTime: createState.checkInTime, checkOutTime: createState.checkOutTime }} /> : null}
      </div>
    </TooltipProvider>
  );
}

function RoomLabel({ room }: { room: RoomVM }) {
  const status = ROOM_STATUS[room.status] ?? ROOM_STATUS.AVAILABLE;
  return (
    <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2.5 border-r bg-card px-3" style={{ width: LABEL_W }}>
      <Tooltip><TooltipTrigger asChild><span className={cn("size-2.5 shrink-0 rounded-full ring-2 ring-background", status.dot)} aria-label={status.label} /></TooltipTrigger><TooltipContent side="right"><div className="font-medium">Номер {room.number}</div><div className="opacity-80">{status.label}</div></TooltipContent></Tooltip>
      <div className="min-w-0"><div className="truncate text-sm font-semibold leading-tight" title={room.number}>{room.number}</div><div className="truncate text-[11px] text-muted-foreground">этаж {room.floor}</div></div>
    </div>
  );
}

function ReservationBar({ reservation, left, width, height, top, clippedStart, clippedEnd, moving, preferences, highlighted, turnaroundMinutes: gapMinutes, onDragStart, onDragEnd, onOpen }: { reservation: ReservationVM; left: number; width: number; height: number; top: number; clippedStart: boolean; clippedEnd: boolean; moving: boolean; preferences: CalendarPreferences; highlighted: boolean; turnaroundMinutes?: number; onDragStart: () => void; onDragEnd: () => void; onOpen: () => void }) {
  const nights = diffDays(parseISODate(reservation.checkIn), parseISODate(reservation.checkOut));
  const statusStyle = RESERVATION_STYLES[reservation.status] ?? RESERVATION_STYLES.CONFIRMED;
  const guestCount = reservation.children > 0 ? `${reservation.adults}+${reservation.children}` : `${reservation.adults}`;
  const titleParts = [preferences.showGuestName ? reservation.guestName : null, preferences.showGuestCount && width >= 88 ? guestCount : null].filter(Boolean);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={moving}
          onClick={(event) => { event.stopPropagation(); onOpen(); }}
          onTouchStart={(event) => { event.currentTarget.draggable = false; }}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", reservation.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          draggable={!moving && ACTIVE_RESERVATION_STATUSES.includes(reservation.status)}
          style={{ left, width, height, top }}
          aria-label={`${reservation.guestName}, номер ${reservation.roomNumber}, заезд ${formatISODate(reservation.checkIn)} в ${reservation.checkInTime}, выезд ${formatISODate(reservation.checkOut)} в ${reservation.checkOutTime}`}
          className={cn(
            "absolute z-10 flex cursor-grab items-center gap-1.5 overflow-hidden rounded-lg border py-1.5 pl-4 pr-3 text-left shadow-[0_1px_2px_rgba(25,62,48,0.10)] transition-[filter,box-shadow,opacity] before:absolute before:inset-y-1.5 before:left-1.5 before:w-0.5 before:rounded-full hover:z-20 hover:brightness-[0.98] hover:shadow-[0_3px_8px_rgba(25,62,48,0.14)] active:cursor-grabbing focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            clippedStart && "rounded-l-none pl-2.5 before:left-0.5",
            clippedEnd && "rounded-r-none pr-2.5",
            statusStyle.bar,
            moving && "opacity-55",
            highlighted && "ring-2 ring-primary ring-offset-1",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">{titleParts.length ? titleParts.join(" · ") : reservationDisplayId(reservation.sequenceNumber)}{reservation.status === "PENDING" ? " · ожидает" : ""}</span>
          <span className="flex shrink-0 items-center gap-1">
            <span className={cn("size-2 rounded-full ring-2 ring-white/70", statusStyle.dot)} title={statusStyle.label}><span className="sr-only">{statusStyle.label}</span></span>
            {preferences.showNotes && reservation.notes ? <StickyNote className="size-3 opacity-65" aria-label="Есть заметка" /> : null}
            {gapMinutes !== undefined && gapMinutes < 60 ? <Clock3 className="size-3 text-amber-700" aria-label={turnaroundMessage(gapMinutes)} /> : null}
            {preferences.showReservationId && width >= 120 ? <span className="font-mono text-[9px] opacity-70">{reservationDisplayId(reservation.sequenceNumber)}</span> : null}
            {preferences.showAmount && width >= 144 ? <span className="text-[10px] font-semibold tabular-nums opacity-85">{formatReservationMoney(reservation.totalAmount, reservation.currency, preferences.currencyDisplay)}</span> : null}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="block max-w-72 p-3">
        <div className="font-semibold">{reservation.guestName}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium"><span className={cn("size-2 rounded-full", statusStyle.dot)} />{statusStyle.label}</div>
        <div className="mt-1 opacity-85">{formatISODate(reservation.checkIn)}, {reservation.checkInTime} → {formatISODate(reservation.checkOut)}, {reservation.checkOutTime}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 opacity-75"><span>{nights} ноч.</span><span>{reservation.adults} взр. · {reservation.children} дет.</span><span>Номер {reservation.roomNumber}</span><span>{channelLabel(reservation.channel)}</span></div>
        {gapMinutes !== undefined ? <div className={cn("mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", gapMinutes < 60 ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950")}><Clock3 className="size-3.5" />{turnaroundMessage(gapMinutes)}</div> : null}
        <div className="mt-1.5 font-semibold tabular-nums">{formatReservationMoney(reservation.totalAmount, reservation.currency, "CODE")}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <span className="inline-flex items-baseline gap-1.5 text-xs text-muted-foreground">{label}<strong className="text-sm font-semibold tabular-nums text-primary">{value}</strong></span>;
}

function Legend({ style }: { style: (typeof RESERVATION_STYLES)[string] }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1", style.legend)}><span className={cn("size-2 rounded-full", style.dot)} />{style.label}</span>;
}

function formatReservationMoney(amount: number, currency: string, display: CalendarPreferences["currencyDisplay"]): string {
  try {
    if (display === "HIDDEN") return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, currencyDisplay: display === "CODE" ? "code" : "narrowSymbol", maximumFractionDigits: 0 }).format(amount);
  } catch {
    const formatted = Math.round(amount).toLocaleString("ru-RU");
    return display === "HIDDEN" ? formatted : `${formatted} ${currency}`;
  }
}

export function CalendarBoardSkeleton() {
  return <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {t.calendar.loadingBoard}</div>;
}

export function formatRangeShort(a: string, b: string): string {
  return `${formatISOCompactDate(a)} → ${formatISOCompactDate(b)}`;
}
