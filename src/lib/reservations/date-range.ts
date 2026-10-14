import {
  addDays,
  diffDays,
  isISODate,
  parseISODate,
  startOfMonth,
  toISODate,
} from "@/lib/dates";

export interface DateRange {
  checkIn: string;
  checkOut: string;
}
export interface CalendarStay extends DateRange {
  id: string;
  roomId: string;
  checkInTime: string;
  checkOutTime: string;
}
export interface TimedRange extends DateRange {
  checkInTime: string;
  checkOutTime: string;
}

/** Nights remain [arrival, departure). Times only constrain shared turnover dates.
 * Existing model has no configured mandatory cleaning buffer; never invent one. */
export function staysConflict(a: TimedRange, b: TimedRange): boolean {
  if (a.checkIn < b.checkOut && a.checkOut > b.checkIn) return true;
  if (a.checkIn === b.checkOut && a.checkInTime < b.checkOutTime) return true;
  return a.checkOut === b.checkIn && a.checkOutTime > b.checkInTime;
}

export function selectRangeDay(range: DateRange, day: string): DateRange {
  if (!isISODate(day)) return range;
  if (!range.checkIn || range.checkOut || day <= range.checkIn)
    return { checkIn: day, checkOut: "" };
  return { checkIn: range.checkIn, checkOut: day };
}

export function validBookingRange(range: DateRange): boolean {
  return (
    isISODate(range.checkIn) &&
    isISODate(range.checkOut) &&
    range.checkOut > range.checkIn &&
    diffDays(parseISODate(range.checkIn), parseISODate(range.checkOut)) <= 366
  );
}

export function monthDays(month: string): (string | null)[] {
  const first = startOfMonth(parseISODate(month));
  const offset = (first.getUTCDay() + 6) % 7;
  const result: (string | null)[] = Array.from({ length: offset }, () => null);
  for (
    let day = first;
    day.getUTCMonth() === first.getUTCMonth();
    day = addDays(day, 1)
  )
    result.push(toISODate(day));
  while (result.length % 7) result.push(null);
  return result;
}

/** Integer minor units prevent accumulation errors; checkout rate is excluded. */
export function nightlyTotal(
  basePrice: number,
  checkIn: string,
  checkOut: string,
  rates: readonly { date: string; price: number }[],
): number {
  if (!isISODate(checkIn) || !isISODate(checkOut) || checkOut <= checkIn)
    throw new Error("Invalid stay range");
  const byDate = new Map(
    rates.map((rate) => [rate.date, Math.round(rate.price * 100)]),
  );
  let minor = 0;
  for (
    let day = parseISODate(checkIn);
    toISODate(day) < checkOut;
    day = addDays(day, 1)
  )
    minor += byDate.get(toISODate(day)) ?? Math.round(basePrice * 100);
  return minor / 100;
}
