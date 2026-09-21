import { addDays, diffDays, isISODate, parseISODate, toISODate } from "@/lib/dates";

export const CALENDAR_RANGE_OPTIONS = [7, 14, 30] as const;
export type CalendarRangeDays = (typeof CALENDAR_RANGE_OPTIONS)[number];
export const DEFAULT_CALENDAR_RANGE: CalendarRangeDays = 14;

const RANGE_VALUES = new Set<string>(CALENDAR_RANGE_OPTIONS.map(String));
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function parseCalendarRange(value: unknown): CalendarRangeDays {
  return typeof value === "string" && RANGE_VALUES.has(value)
    ? Number(value) as CalendarRangeDays
    : DEFAULT_CALENDAR_RANGE;
}

export function parseCalendarNavigation(
  dateValue: unknown,
  rangeValue: unknown,
  todayISO: string,
): { anchorISO: string; rangeDays: CalendarRangeDays } {
  return {
    anchorISO: typeof dateValue === "string" && isISODate(dateValue) ? dateValue : todayISO,
    rangeDays: parseCalendarRange(rangeValue),
  };
}

export function calendarTimelineRange(anchorISO: string, days: CalendarRangeDays) {
  const start = parseISODate(anchorISO);
  return { start, endExclusive: addDays(start, days), days };
}

export function shiftCalendarAnchor(anchorISO: string, days: CalendarRangeDays, direction: 1 | -1): string {
  return toISODate(addDays(parseISODate(anchorISO), days * direction));
}

export function formatCalendarRange(anchorISO: string, days: CalendarRangeDays): string {
  const start = parseISODate(anchorISO);
  const end = addDays(start, days - 1);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${start.getUTCDate()} — ${end.getUTCDate()} ${MONTHS_GENITIVE[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${start.getUTCDate()} ${MONTHS_GENITIVE[start.getUTCMonth()]} — ${end.getUTCDate()} ${MONTHS_GENITIVE[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  }
  return `${start.getUTCDate()} ${MONTHS_GENITIVE[start.getUTCMonth()]} ${start.getUTCFullYear()} — ${end.getUTCDate()} ${MONTHS_GENITIVE[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/** A stay occupies [checkIn, checkOut): checkout day is available again. */
export function clipStay(checkIn: string, checkOut: string, start: Date, days: number) {
  const from = diffDays(start, parseISODate(checkIn));
  const to = diffDays(start, parseISODate(checkOut));
  if (to <= 0 || from >= days || to <= from) return null;
  return { start: Math.max(0, from), end: Math.min(days, to), clippedStart: from < 0 };
}

/**
 * Visual PMS placement: arrivals start at the middle of the arrival date and
 * departures end at the middle of the departure date. A small gap keeps
 * back-to-back stays visually distinct while preserving the half-day model.
 */
export function calendarStayPosition(
  checkIn: string,
  checkOut: string,
  start: Date,
  days: number,
  dayWidth: number,
  gap = 4,
) {
  const from = diffDays(start, parseISODate(checkIn));
  const to = diffDays(start, parseISODate(checkOut));
  const timelineWidth = days * dayWidth;
  const rawLeft = (from + 0.5) * dayWidth;
  const rawRight = (to + 0.5) * dayWidth;
  if (rawRight <= 0 || rawLeft >= timelineWidth || rawRight <= rawLeft) return null;

  const clippedStart = rawLeft < 0;
  const clippedEnd = rawRight > timelineWidth;
  const halfGap = gap / 2;
  const left = Math.max(0, rawLeft + (clippedStart ? 0 : halfGap));
  const right = Math.min(timelineWidth, rawRight - (clippedEnd ? 0 : halfGap));
  return { left, width: Math.max(Math.min(20, dayWidth * 0.7), right - left), clippedStart, clippedEnd };
}

export function staysOverlap(aIn: string, aOut: string, bIn: string, bOut: string) {
  return aIn < bOut && aOut > bIn;
}
