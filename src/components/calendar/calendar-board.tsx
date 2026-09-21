"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Clock3, Loader2, Settings2, StickyNote, X, ZoomIn, ZoomOut } from "lucide-react";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { reservationMatchesCalendarSearch } from "@/lib/reservations/calendar-search";
import { calendarStayPosition, calendarTimelineRange, shiftCalendarAnchor, staysOverlap, type CalendarRangeDays } from "@/lib/reservations/calendar-range";
import { buildTurnaroundMap, suggestQuickBookingSlot, turnaroundMessage } from "@/lib/reservations/calendar-turnaround";
import { findSelectedReservation } from "@/lib/reservations/calendar-selection";
import { EmptyState } from "@/components/shared/page-header";
import { ReservationDetailsDialog } from "@/components/reservations/reservation-details-dialog";
import { ReservationFormDialog } from "@/components/reservations/reservation-form-dialog";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { MobileCalendar } from "@/components/calendar/mobile-calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { moveReservationAction } from "@/server/actions/reservations";
import { saveCalendarPreferencesAction } from "@/server/actions/calendar";
import type { CalendarBoardData, CalendarFilters, CalendarPreferences } from "./types";
import { reservationDisplayId, type ReservationVM, type RoomVM } from "@/lib/types";
import { channelLabel, t } from "@/lib/i18n";
import { addDays, diffDays, eachDay, formatISOCompactDate, formatISODate, formatMonthYear, isSameDay, parseISODate, toISODate, weekdayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

const ROOM_WIDTHS = { COMPACT: 160, STANDARD: 208, WIDE: 264 } as const;
const DAY_W: Record<CalendarRangeDays, number> = { 7: 136, 14: 84, 30: 52 };

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;
const MOBILE_ZOOM_MAX = 8;

const RESERVATION_STYLES: Record<string, { bar: string; dot: string; label: string; legend: string }> = {
  CANCELLED: { bar: "border-rose-400 bg-rose-100 text-rose-950 before:bg-rose-600 dark:border-rose-700 dark:bg-rose-950/70 dark:text-rose-100", dot: "bg-rose-600", label: "Отменена", legend: "border-rose-300 bg-rose-100 text-rose-950" },
  NO_SHOW: { bar: "border-slate-400 bg-slate-200 text-slate-900 before:bg-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100", dot: "bg-slate-600", label: "Неявка", legend: "border-slate-300 bg-slate-100 text-slate-800" },
  CHECKED_OUT: { bar: "border-sky-300 bg-sky-100 text-sky-950 before:bg-sky-600 dark:border-sky-700 dark:bg-sky-950/70 dark:text-sky-100", dot: "bg-sky-600", label: "Выехал", legend: "border-sky-300 bg-sky-100 text-sky-950" },
  PENDING: {
    bar: "border-blue-400 bg-blue-100 text-blue-950 before:bg-blue-600 dark:border-blue-600 dark:bg-blue-900/70 dark:text-blue-50",
    dot: "bg-blue-600",
    label: "Ожидает",
    legend: "border-blue-300 bg-blue-100 text-blue-950",
  },
  CONFIRMED: {
    bar: "border-amber-400 bg-amber-100 text-amber-950 before:bg-amber-600 dark:border-amber-600 dark:bg-amber-900/70 dark:text-amber-50",
    dot: "bg-amber-600",
    label: "Подтверждена",
    legend: "border-amber-300 bg-amber-100 text-amber-950",
  },
  CHECKED_IN: {
    bar: "border-emerald-500 bg-emerald-100 text-emerald-950 before:bg-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-50",
    dot: "bg-emerald-700",
    label: "Заселён",
    legend: "border-emerald-300 bg-emerald-100 text-emerald-950",
  },
};

const CALM_RESERVATION_STYLES: Record<string, { bar: string; dot: string; label: string; legend: string }> = {
  ...RESERVATION_STYLES,
  PENDING: { bar: "border-[#a9bed4] bg-[#e4ecf4] text-[#29475e] before:bg-[#557c9f] dark:border-[#617e99] dark:bg-[#293f52] dark:text-[#e6eff7]", dot: "bg-[#557c9f]", label: "Ожидает", legend: "border-[#bdd0e1] bg-[#eaf1f7] text-[#29475e]" },
  CANCELLED: { bar: "border-[#d7b6b8] bg-[#f1e6e6] text-[#67454a] before:bg-[#a4767d] dark:border-[#805e64] dark:bg-[#443337] dark:text-[#f1e4e5]", dot: "bg-[#a4767d]", label: "Отменена", legend: "border-[#e1cdd0] bg-[#f4ebec] text-[#67454a]" },
  NO_SHOW: { bar: "border-slate-300 bg-slate-100 text-slate-700 before:bg-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200", dot: "bg-slate-400", label: "Неявка", legend: "border-slate-200 bg-slate-100 text-slate-700" },
  CHECKED_OUT: { bar: "border-[#b7c9ce] bg-[#e7eef0] text-[#425b62] before:bg-[#77959d] dark:border-[#667d83] dark:bg-[#34484d] dark:text-[#e4edef]", dot: "bg-[#77959d]", label: "Выехал", legend: "border-[#d2dfe2] bg-[#edf2f3] text-[#425b62]" },
  CONFIRMED: { bar: "border-[#c9bca0] bg-[#f1ece0] text-[#554b37] before:bg-[#a18a5b] dark:border-[#85785e] dark:bg-[#3e392f] dark:text-[#eee8da]", dot: "bg-[#a18a5b]", label: "Подтверждена", legend: "border-[#ded4c2] bg-[#f5f0e7] text-[#554b37]" },
  CHECKED_IN: { bar: "border-[#83aaa2] bg-[#dcece8] text-[#11473d] before:bg-[#21675a] dark:border-[#65978d] dark:bg-[#244f47] dark:text-white", dot: "bg-[#21675a]", label: "Заселён", legend: "border-[#bdd6d0] bg-[#e7f2ef] text-[#175247]" },
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
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [showMobileTools, setShowMobileTools] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextScrollLeft = useRef<number | null>(null);
  const pinch = useRef<{ distance: number; zoom: number; dayIndex: number } | null>(null);
  const router = useRouter();

  const today = parseISODate(data.todayISO);
  const range = useMemo(() => calendarTimelineRange(anchorISO, rangeDays), [anchorISO, rangeDays]);
  const days = useMemo(() => eachDay(range.start, range.endExclusive), [range.start, range.endExclusive]);
  const mobileFullscreen = viewportWidth > 0 && viewportWidth < 640 && fullscreen;
  const labelWidth = viewportWidth > 0 && viewportWidth < 640 ? Math.max(136, ROOM_WIDTHS[preferences.roomColumnWidth] - 48) : ROOM_WIDTHS[preferences.roomColumnWidth];
  const fitDayWidth = mobileFullscreen ? Math.max(68, DAY_W[rangeDays]) : fullscreen && viewportWidth >= 640 ? Math.max(DAY_W[rangeDays], (viewportWidth - labelWidth - 16) / rangeDays) : DAY_W[rangeDays];
  const dayWidth = mobileFullscreen ? fitDayWidth * zoom : Math.round(fitDayWidth * zoom);
  const overview = mobileFullscreen && dayWidth < 24;
  const density = DENSITY[preferences.density];
  const rowHeight = mobileFullscreen ? Math.max(44, Math.round(density.row * Math.min(zoom, 1.5))) : density.row;
  const blockHeight = mobileFullscreen ? Math.max(18, rowHeight - 6) : density.block;
  const blockTop = mobileFullscreen ? Math.max(3, Math.round((rowHeight - blockHeight) / 2)) : density.top;
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
    if (reservation.status === "CANCELLED" && filters.statusId !== "CANCELLED") return false;
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
      const position = calendarStayPosition(reservation.checkIn, reservation.checkOut, range.start, range.days, dayWidth, mobileFullscreen ? Math.min(4, dayWidth * 0.25) : 4);
      if (!position) continue;
      const blocks = grouped.get(reservation.roomId) ?? [];
      blocks.push({ res: reservation, ...position });
      grouped.set(reservation.roomId, blocks);
    }
    return grouped;
  }, [dayWidth, mobileFullscreen, range.days, range.start, visibleReservations]);

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

  useEffect(() => {
    const updateWidth = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useLayoutEffect(() => {
    if (nextScrollLeft.current !== null && scrollRef.current) {
      scrollRef.current.scrollLeft = nextScrollLeft.current;
      nextScrollLeft.current = null;
    }
  }, [dayWidth]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!mobileFullscreen || !element) return;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const center = (touches: TouchList) => (touches[0].clientX + touches[1].clientX) / 2 - element.getBoundingClientRect().left;
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const focus = center(event.touches);
      pinch.current = { distance: distance(event.touches), zoom, dayIndex: (element.scrollLeft + focus - labelWidth) / dayWidth };
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinch.current) return;
      event.preventDefault();
      const nextZoom = Math.min(MOBILE_ZOOM_MAX, Math.max(1, Math.round(pinch.current.zoom * distance(event.touches) / pinch.current.distance * 10) / 10));
      nextScrollLeft.current = Math.max(0, labelWidth + pinch.current.dayIndex * fitDayWidth * nextZoom - center(event.touches));
      setZoom(nextZoom);
      if (nextZoom === zoom) element.scrollLeft = nextScrollLeft.current;
    };
    const onEnd = (event: TouchEvent) => { if (event.touches.length < 2) pinch.current = null; };
    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onEnd);
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onEnd);
    };
  }, [dayWidth, fitDayWidth, labelWidth, mobileFullscreen, zoom]);

  function navigate(nextAnchor: string, nextRange: CalendarRangeDays = rangeDays) {
    if (nextRange !== rangeDays) setZoom(1);
    if (nextRange !== preferences.rangeDays) void savePreferences({ ...preferences, rangeDays: nextRange }, true);
    const query = new URLSearchParams({ date: nextAnchor, range: String(nextRange) });
    startNavigation(() => router.push(`/dashboard/calendar?${query.toString()}`, { scroll: false }));
  }

  function shift(direction: 1 | -1) {
    navigate(shiftCalendarAnchor(anchorISO, rangeDays, direction));
  }

  function changeZoom(direction: 1 | -1) {
    const next = Math.min(mobileFullscreen ? MOBILE_ZOOM_MAX : ZOOM_MAX, Math.max(mobileFullscreen ? 1 : ZOOM_MIN, zoom + direction * (mobileFullscreen ? 1 : ZOOM_STEP)));
    if (mobileFullscreen && scrollRef.current) {
      const element = scrollRef.current;
      const center = element.clientWidth / 2;
      const dayIndex = (element.scrollLeft + center - labelWidth) / dayWidth;
      nextScrollLeft.current = Math.max(0, labelWidth + dayIndex * fitDayWidth * next - center);
    }
    setZoom(next);
  }

  function closeFullscreen() {
    setFullscreen(false);
    setZoom(1);
  }

  async function savePreferences(next: CalendarPreferences, silent = false): Promise<boolean> {
    setSavingPreferences(true);
    try {
      const result = await saveCalendarPreferencesAction(next);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      setPreferences(next);
      if (!silent) toast.success("Вид шахматки сохранён");
      return true;
    } catch {
      toast.error("Не удалось сохранить вид. Попробуйте ещё раз.");
      return false;
    } finally {
      setSavingPreferences(false);
    }
  }

  function toggleGroup(roomTypeId: string) {
    const collapsed = new Set(preferences.collapsedRoomTypeIds);
    if (collapsed.has(roomTypeId)) collapsed.delete(roomTypeId);
    else collapsed.add(roomTypeId);
    void savePreferences({ ...preferences, collapsedRoomTypeIds: Array.from(collapsed) }, true);
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

  const toolbar = (
    <CalendarToolbar
      anchorISO={anchorISO}
      rangeDays={rangeDays}
      todayISO={data.todayISO}
      filters={filters}
      preferences={preferences}
      roomTypeOptions={roomTypeOptions}
      rooms={rooms}
      canReorderRooms={data.canReorderRooms}
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
      onFullscreen={() => setFullscreen(true)}
      fullscreen={fullscreen}
    />
  );

  const dialogs = (
    <>
      {selected ? <ReservationDetailsDialog reservation={selected} rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotelCurrency} open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setSelectedId(null); }} /> : null}
      {createState.open ? <ReservationFormDialog compact mode="create" open={createState.open} onOpenChange={(open) => setCreateState((state) => ({ ...state, open }))} rooms={rooms} ratePlans={ratePlans} guests={guests} hotelCurrency={hotelCurrency} contextNote={createState.contextNote} initial={{ roomId: createState.roomId, checkIn: createState.date ?? data.todayISO, checkOut: createState.checkOut ?? toISODate(addDays(parseISODate(createState.date ?? data.todayISO), 1)), checkInTime: createState.checkInTime, checkOutTime: createState.checkOutTime }} /> : null}
    </>
  );

  if (viewportWidth === 0) return <CalendarBoardSkeleton />;
  if (viewportWidth < 640) return <>
    <MobileCalendar anchorISO={anchorISO} todayISO={data.todayISO} viewportWidth={viewportWidth} rooms={visibleRooms} reservations={visibleReservations} navigating={navigating} onShift={(count) => navigate(toISODate(addDays(parseISODate(anchorISO), count)))} onToday={() => navigate(data.todayISO)} onOpen={(id) => { setSelectedId(id); setDetailsOpen(true); }} onCreate={(roomId, date) => { if (roomId && date) openQuickBooking(roomId, date); else setCreateState({ open: true }); }} />
    {dialogs}
  </>;

  const board = (
    <>
      <div className={cn("flex border-b bg-secondary", mobileFullscreen ? "h-6" : "h-7", fullscreen && "sticky top-0 z-40")}>
        <div className={cn("sticky left-0 z-40 flex shrink-0 items-center border-r bg-secondary text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", mobileFullscreen ? "px-1.5" : "px-3")} style={{ width: labelWidth }}>{mobileFullscreen ? "Номера" : "Категория / номер"}</div>
        <div className="flex">{monthSegments.map((segment) => <div key={segment.key} style={{ width: segment.days * dayWidth }} className="shrink-0 overflow-hidden border-r py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0"><span className="block w-fit whitespace-nowrap px-2">{overview ? segment.label.slice(0, 3) : segment.label}</span></div>)}</div>
      </div>
      <div className={cn("flex border-b bg-secondary", mobileFullscreen ? "h-8" : "h-12", fullscreen && (mobileFullscreen ? "sticky top-6 z-40" : "sticky top-7 z-40"))}>
        <div className={cn("sticky left-0 z-40 flex shrink-0 items-end border-r bg-secondary text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", mobileFullscreen ? "px-1.5 pb-1" : "px-3 pb-2")} style={{ width: labelWidth }}>{mobileFullscreen ? "Номер" : "Номер и статус"}</div>
        <div className="flex">{days.map((day) => {
          const isToday = isSameDay(day, today);
          const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
          return <div key={day.toISOString()} style={{ width: dayWidth }} title={formatISODate(toISODate(day))} className={cn("flex shrink-0 flex-col items-center justify-center overflow-hidden border-l first:border-l-0", weekend && !isToday && "bg-secondary/40", isToday && "bg-primary/10")}>
            {!overview && dayWidth >= 42 ? <span className={cn("text-[10px] uppercase tracking-wide text-muted-foreground", isToday && "font-semibold text-primary")}>{isToday ? "Сегодня" : weekdayShort(day)}</span> : null}
            {(!overview || day.getUTCDate() === 1 || day.getUTCDate() % 5 === 0 || isToday) ? <span className={cn("tabular-nums", overview ? "text-[9px] font-semibold" : "mt-0.5 text-sm", isToday && !overview ? "flex size-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" : "font-medium", isToday && overview && "text-primary")}>{day.getUTCDate()}</span> : null}
          </div>;
        })}</div>
      </div>

      {roomGroups.length === 0 ? (
        <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">По вашему запросу ничего не найдено.</div>
      ) : roomGroups.map((group) => {
        const collapsed = preferences.collapsedRoomTypeIds.includes(group.id);
        return (
          <div key={group.id}>
            <div className="flex h-8 border-b border-border/80 bg-secondary/80">
              <button type="button" onClick={() => toggleGroup(group.id)} className={cn("sticky left-0 z-30 flex shrink-0 items-center overflow-hidden border-r bg-secondary text-left hover:bg-accent", mobileFullscreen ? "px-1" : "px-3")} style={{ width: labelWidth }} aria-expanded={!collapsed}>
                {collapsed ? <ChevronRight className="mr-1.5 size-3.5" /> : <ChevronDown className="mr-1.5 size-3.5" />}
                <span className="truncate text-xs font-semibold" title={group.name}>{group.name}</span>{!mobileFullscreen ? <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">{group.rooms.length}</span> : null}
              </button>
              <div aria-hidden="true" className="shrink-0" style={{ width: range.days * dayWidth }} />
            </div>
            {!collapsed ? group.rooms.map((room) => (
              <div key={room.id} className="relative flex border-b last:border-b-0" style={{ height: rowHeight }}>
                <RoomLabel room={room} width={labelWidth} compact={mobileFullscreen} />
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
                      height={blockHeight}
                      top={blockTop}
                      overview={overview}
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
    </>
  );

  return (
    <TooltipProvider delayDuration={250}>
      <div className="space-y-3">
        {toolbar}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border bg-card px-3.5 py-1.5 shadow-xs" aria-label="Сводка на сегодня">
          <Metric label="Заезды" value={todayStats.arrivals} />
          <Metric label="Выезды" value={todayStats.departures} />
          <Metric label="Проживают" value={todayStats.staying} />
          <Metric label="Свободно" value={todayStats.available} />
          <span className="ml-auto hidden items-center gap-3 border-l pl-4 text-xs text-muted-foreground lg:flex" aria-label="Статусы бронирований">
            <Legend style={(preferences.reservationColors === "CALM" ? CALM_RESERVATION_STYLES : RESERVATION_STYLES).PENDING} />
            <Legend style={(preferences.reservationColors === "CALM" ? CALM_RESERVATION_STYLES : RESERVATION_STYLES).CONFIRMED} />
            <Legend style={(preferences.reservationColors === "CALM" ? CALM_RESERVATION_STYLES : RESERVATION_STYLES).CHECKED_IN} />
          </span>
        </div>

        {rooms.length === 0 ? (
          <EmptyState icon={CalendarPlus} title={t.calendar.noRoomsTitle} description={t.calendar.noRoomsDescription} action={<Link href="/dashboard/rooms" className="text-sm font-medium text-primary hover:underline">{t.calendar.goToRooms}</Link>} />
        ) : fullscreen ? (
          <Dialog open onOpenChange={(open) => { if (!open) closeFullscreen(); }}>
            <DialogContent
              showCloseButton={false}
              aria-describedby={undefined}
              className="fixed inset-0 flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-none bg-background p-0 ring-0 sm:max-w-full data-closed:zoom-out-100 data-open:zoom-in-100"
            >
              <div className="flex shrink-0 items-center justify-between gap-1 border-b bg-card px-2 py-1.5">
                <DialogTitle className="truncate text-sm font-semibold">Шахматка · {rangeDays} дней</DialogTitle>
                <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex"><Metric label="Заезды" value={todayStats.arrivals} /><Metric label="Выезды" value={todayStats.departures} /><Metric label="Проживают" value={todayStats.staying} /></div>
                <div className="flex shrink-0 items-center">
                  {mobileFullscreen ? <Button variant="ghost" size="icon-sm" onClick={() => setShowMobileTools((current) => !current)} aria-label="Инструменты шахматки" aria-expanded={showMobileTools}><Settings2 className="size-4" /></Button> : null}
                  <Button variant="ghost" size="icon-sm" onClick={() => changeZoom(-1)} disabled={zoom <= (mobileFullscreen ? 1 : ZOOM_MIN)} aria-label="Уменьшить масштаб"><ZoomOut className="size-4" /></Button>
                  <button type="button" onClick={() => { nextScrollLeft.current = 0; setZoom(1); if (scrollRef.current) scrollRef.current.scrollLeft = 0; }} className="w-11 text-center text-xs tabular-nums text-muted-foreground" aria-label="Показать весь диапазон">{Math.round(zoom * 100)}%</button>
                  <Button variant="ghost" size="icon-sm" onClick={() => changeZoom(1)} disabled={zoom >= (mobileFullscreen ? MOBILE_ZOOM_MAX : ZOOM_MAX)} aria-label="Увеличить масштаб"><ZoomIn className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={closeFullscreen} aria-label="Закрыть"><X className="size-4" /></Button>
                </div>
              </div>
              {mobileFullscreen ? <div className="flex shrink-0 items-center justify-between border-b bg-card px-2 py-1 text-xs">
                <div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} disabled={navigating} aria-label="Предыдущие дни"><ChevronLeft className="size-4" /></Button><button type="button" onClick={() => navigate(data.todayISO)} className="rounded px-1.5 py-1 font-medium text-primary hover:bg-accent">Сегодня</button><Button variant="ghost" size="icon-sm" onClick={() => shift(1)} disabled={navigating} aria-label="Следующие дни"><ChevronRight className="size-4" /></Button></div>
                <span className="truncate text-[11px] text-muted-foreground">{formatRangeShort(anchorISO, toISODate(addDays(range.start, range.days - 1)))}</span>
              </div> : null}
              {(!mobileFullscreen || showMobileTools) ? <div className="shrink-0 border-b bg-secondary/30 p-2">{toolbar}</div> : null}
              <div className="flex min-h-0 flex-1 flex-col bg-card">
                <div ref={scrollRef} className={cn("calendar-timeline-scroll min-h-0 flex-1 overflow-auto overscroll-contain", mobileFullscreen && "calendar-timeline-scroll--mobile")}>
                  <div style={{ width: labelWidth + range.days * dayWidth }}>{board}</div>
                </div>
              </div>
              {mobileFullscreen ? <div className="flex shrink-0 items-center justify-center gap-1.5 border-t bg-card px-1 py-1 text-[10px]" aria-label="Статусы бронирований">
                <Legend style={(preferences.reservationColors === "CALM" ? CALM_RESERVATION_STYLES : RESERVATION_STYLES).PENDING} compact />
                <Legend style={(preferences.reservationColors === "CALM" ? CALM_RESERVATION_STYLES : RESERVATION_STYLES).CONFIRMED} compact />
                <Legend style={(preferences.reservationColors === "CALM" ? CALM_RESERVATION_STYLES : RESERVATION_STYLES).CHECKED_IN} compact />
              </div> : null}
              {dialogs}
            </DialogContent>
          </Dialog>
        ) : (
          <div className="isolate overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="calendar-timeline-scroll overflow-x-auto overscroll-x-contain">
              <div style={{ minWidth: labelWidth + range.days * dayWidth }}>{board}</div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">Нажмите на свободную ячейку для новой брони. Перетащите бронь на свободный номер или дату — сервер повторно проверит доступность.</p>

        {!fullscreen ? dialogs : null}
      </div>
    </TooltipProvider>
  );
}

function RoomLabel({ room, width, compact }: { room: RoomVM; width: number; compact: boolean }) {
  const status = ROOM_STATUS[room.status] ?? ROOM_STATUS.AVAILABLE;
  return (
    <div className={cn("sticky left-0 z-30 flex shrink-0 items-center border-r bg-card", compact ? "gap-1 px-1.5" : "gap-2.5 px-3")} style={{ width }}>
      <Tooltip><TooltipTrigger asChild><span className={cn("size-2.5 shrink-0 rounded-full ring-2 ring-background", status.dot)} aria-label={status.label} /></TooltipTrigger><TooltipContent side="right"><div className="font-medium">Номер {room.number}</div><div className="opacity-80">{status.label}</div></TooltipContent></Tooltip>
      <div className="min-w-0"><div className={cn("truncate font-semibold leading-tight", compact ? "text-xs" : "text-sm")} title={room.number}>{room.number}</div>{!compact ? <div className="truncate text-[11px] text-muted-foreground">этаж {room.floor}</div> : null}</div>
    </div>
  );
}

function ReservationBar({ reservation, left, width, height, top, overview, clippedStart, clippedEnd, moving, preferences, highlighted, turnaroundMinutes: gapMinutes, onDragStart, onDragEnd, onOpen }: { reservation: ReservationVM; left: number; width: number; height: number; top: number; overview: boolean; clippedStart: boolean; clippedEnd: boolean; moving: boolean; preferences: CalendarPreferences; highlighted: boolean; turnaroundMinutes?: number; onDragStart: () => void; onDragEnd: () => void; onOpen: () => void }) {
  const nights = diffDays(parseISODate(reservation.checkIn), parseISODate(reservation.checkOut));
  const styles = preferences.reservationColors === "CALM" ? CALM_RESERVATION_STYLES : RESERVATION_STYLES;
  const statusStyle = styles[reservation.status] ?? styles.CONFIRMED;
  const overviewFill = preferences.reservationColors === "CALM"
    ? ({ PENDING: "bg-[#557c9f]", CONFIRMED: "bg-[#a18a5b]", CHECKED_IN: "bg-[#21675a]" } as Record<string, string>)[reservation.status]
    : ({ PENDING: "bg-blue-600", CONFIRMED: "bg-amber-500", CHECKED_IN: "bg-emerald-600" } as Record<string, string>)[reservation.status];
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
            overview && "rounded-sm py-0 pl-0 pr-0 before:hidden",
            clippedStart && "rounded-l-none pl-2.5 before:left-0.5",
            clippedEnd && "rounded-r-none pr-2.5",
            statusStyle.bar,
            overview && overviewFill,
            moving && "opacity-55",
            highlighted && "ring-2 ring-primary ring-offset-1",
          )}
        >
          {!overview ? <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">{titleParts.length ? titleParts.join(" · ") : reservationDisplayId(reservation.sequenceNumber)}{reservation.status === "PENDING" ? " · ожидает" : ""}</span> : null}
          {!overview ? <span className="flex shrink-0 items-center gap-1">
            <span className={cn("size-2 rounded-full ring-2 ring-white/70", statusStyle.dot)} title={statusStyle.label}><span className="sr-only">{statusStyle.label}</span></span>
            {preferences.showNotes && reservation.notes ? <StickyNote className="size-3 opacity-65" aria-label="Есть заметка" /> : null}
            {gapMinutes !== undefined && gapMinutes < 60 ? <Clock3 className="size-3 text-amber-700" aria-label={turnaroundMessage(gapMinutes)} /> : null}
            {preferences.showReservationId && width >= 120 ? <span className="font-mono text-[9px] opacity-70">{reservationDisplayId(reservation.sequenceNumber)}</span> : null}
            {preferences.showAmount && width >= 144 ? <span className="text-[10px] font-semibold tabular-nums opacity-85">{formatReservationMoney(reservation.totalAmount, reservation.currency, preferences.currencyDisplay)}</span> : null}
          </span> : null}
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

function Legend({ style, compact = false }: { style: (typeof RESERVATION_STYLES)[string]; compact?: boolean }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1", style.legend, compact && "px-1.5 py-0.5")}><span className={cn("size-2 rounded-full", style.dot)} />{style.label}</span>;
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
