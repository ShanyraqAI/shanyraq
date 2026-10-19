export type ManualBookingPrice = { basis: "night" | "stay"; amount: string } | null;
export const MAX_BOOKING_TOTAL = 1_000_000_000;
/** Money is parsed to integer minor units, not silently truncated or coerced from an empty string. */
export function parsePrice(value: string): number | null {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor <= MAX_BOOKING_TOTAL * 100 ? minor : null;
}
export function bookingPrice(value: ManualBookingPrice, nights: number, quotedTotal: number) {
  const validNights = Number.isInteger(nights) && nights > 0;
  const minor = value ? parsePrice(value.amount) : Math.round(quotedTotal * 100);
  const totalMinor = minor === null ? null : minor * (value?.basis === "night" ? nights : 1);
  const valid = validNights && totalMinor !== null && Number.isSafeInteger(totalMinor) && totalMinor >= 0 && totalMinor <= MAX_BOOKING_TOTAL * 100;
  const total = valid ? totalMinor! / 100 : Number.NaN;
  return { valid, total, perNight: valid ? Math.round(totalMinor! / nights) / 100 : Number.NaN };
}
