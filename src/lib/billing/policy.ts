export const DAY_MS = 86_400_000;
export const TRIAL_MS = 14 * DAY_MS;

export const BILLING_PLANS = [
  { id: "start", name: "Start", monthlyKzt: 9900, rooms: 3 },
  { id: "pro", name: "Pro", monthlyKzt: 19900, rooms: 15 },
  { id: "business", name: "Business", monthlyKzt: 39900, rooms: 50 },
] as const;

export function billingPlan(id: string) {
  return BILLING_PLANS.find((plan) => plan.id === id);
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
