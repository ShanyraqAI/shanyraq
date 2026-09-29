export const DAY_MS = 86_400_000;
export const TRIAL_MS = 14 * DAY_MS;

export const BILLING_PLANS = [
  { id: "start", name: "Start", monthlyKzt: 2990, rooms: 3, range: "До 3 квартир", description: "Календарь и бронирования" },
  { id: "pro", name: "Pro", monthlyKzt: 9990, rooms: 15, range: "От 3 до 15 квартир", description: "Для растущего портфеля" },
  { id: "business", name: "Business", monthlyKzt: 14990, rooms: 50, range: "До 50 квартир", description: "Интеграции Booking.com и Airbnb" },
] as const;

export function billingPlan(id: string) {
  return BILLING_PLANS.find((plan) => plan.id === id);
}

export function remainingTrialDays(trialEndsAt: Date, now = new Date()): number {
  return Math.max(0, Math.min(14, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS)));
}

export class BillingError extends Error {}

export function accessUntil(subscription: { trialEndsAt: Date; paidUntil: Date | null }): Date {
  return new Date(Math.max(subscription.trialEndsAt.getTime(), subscription.paidUntil?.getTime() ?? 0));
}

export function isExpired(subscription: { trialEndsAt: Date; paidUntil: Date | null }, now = new Date()): boolean {
  return now.getTime() >= accessUntil(subscription).getTime();
}

/** Calendar months in UTC, clamped to the last day of the target month. */
export function extendAccess(base: Date, months: number): Date {
  const result = new Date(base);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(base.getUTCDate(), last));
  return result;
}

export function reminderKind(end: Date, now = new Date()): string | null {
  const remaining = end.getTime() - now.getTime();
  if (remaining <= 0) return "expired";
  if (remaining <= DAY_MS) return "one-day";
  if (remaining <= 3 * DAY_MS) return "three-days";
  return null;
}
