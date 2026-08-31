import { diffDays, parseISODate } from "@/lib/dates";

/** A stay occupies [checkIn, checkOut): checkout day is available again. */
export function clipStay(checkIn: string, checkOut: string, start: Date, days: number) {
  const from = diffDays(start, parseISODate(checkIn));
  const to = diffDays(start, parseISODate(checkOut));
  if (to <= 0 || from >= days || to <= from) return null;
  return { start: Math.max(0, from), end: Math.min(days, to), clippedStart: from < 0 };
}

export function staysOverlap(aIn: string, aOut: string, bIn: string, bOut: string) {
  return aIn < bOut && aOut > bIn;
}
