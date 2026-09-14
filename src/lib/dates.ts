/**
 * Hotel date utilities.
 *
 * Hotel business dates ("check-in on Aug 25") are date-only concepts. We store
 * them as UTC midnight instants and always format them with UTC getters, so no
 * timezone can shift a reservation to the previous/next day.
 * The hotel's IANA timezone is stored on the Hotel record for display purposes
 * and future wall-clock features; it never affects date arithmetic here.
 */

export const MS_PER_DAY = 86_400_000;

/** Parse "YYYY-MM-DD" into a UTC-midnight Date. */
export function parseISODate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (toISODate(date) !== iso) throw new Error(`Invalid calendar date: ${iso}`);
  return date;
}

export function isISODate(value: string): boolean {
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

/** Format a hotel date as "YYYY-MM-DD" without timezone shifting. */
export function toISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Today's hotel date as a UTC-midnight Date. */
export function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Today's date in an IANA timezone, returned as a UTC-midnight business date. */
export function todayInTimeZone(timeZone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return parseISODate(`${values.get("year")}-${values.get("month")}-${values.get("day")}`);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const target = new Date(Date.UTC(y, m + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target;
}

export function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Inclusive list of dates from..toExclusive-1 (nights). */
export function eachDay(from: Date, toExclusive: Date): Date[] {
  const out: Date[] = [];
  for (let d = from; d.getTime() < toExclusive.getTime(); d = addDays(d, 1)) {
    out.push(d);
  }
  return out;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_SHORT = ["янв", "февр", "мар", "апр", "мая", "июн", "июл", "авг", "сент", "окт", "нояб", "дек"];
export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatShortDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
}

export function formatMediumDate(date: Date): string {
  return `${WEEKDAYS_SHORT[(date.getUTCDay() + 6) % 7]}, ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Display an ISO hotel date as DD.MM.YYYY. */
export function formatISODate(iso: string): string {
  if (!isISODate(iso)) return iso;
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/** Display an ISO hotel date as DD.MM when the year is already clear. */
export function formatISOCompactDate(iso: string): string {
  if (!isISODate(iso)) return iso;
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

export function formatDayRange(checkIn: Date, checkOut: Date): string {
  if (checkIn.getUTCMonth() === checkOut.getUTCMonth()) {
    return `${checkIn.getUTCDate()} ${MONTHS_SHORT[checkIn.getUTCMonth()]} – ${checkOut.getUTCDate()}`;
  }
  return `${formatShortDate(checkIn)} – ${formatShortDate(checkOut)}`;
}

export function weekdayShort(date: Date): string {
  return WEEKDAYS_SHORT[(date.getUTCDay() + 6) % 7];
}

export function isWeekend(date: Date): boolean {
  const dow = (date.getUTCDay() + 6) % 7;
  return dow >= 5;
}

/** Nights between check-in and check-out (min 1). */
export function stayNights(checkIn: Date, checkOut: Date): number {
  return Math.max(1, diffDays(checkIn, checkOut));
}
