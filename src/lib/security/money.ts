/** Parse decimal money without comparing binary floating-point intermediates. */
export function minorUnits(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(units) ? units : null;
}
