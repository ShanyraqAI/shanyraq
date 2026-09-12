export const MIN_NIGHTLY_PRICE = 1_000;
export const MAX_NIGHTLY_PRICE = 999_000;

export function isNightlyPrice(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_NIGHTLY_PRICE && value <= MAX_NIGHTLY_PRICE;
}

export function formatCompactNightlyPrice(value: number): string {
  if (value < MIN_NIGHTLY_PRICE) return `${value.toLocaleString("ru-RU")} ₸`;
  const thousands = value / 1_000;
  return `${thousands.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} тыс.`;
}
