import { DAY_MS, extendAccess } from "@/lib/billing/policy";

export const WHATSAPP_NUMBER = "77087058827";
export const WHATSAPP_DISPLAY = "+7 708 705 88 27";
export const EXPIRING_SOON_DAYS = 7;
export const GRANT_MONTHS = [1, 3, 6, 12] as const;

export type SubscriptionStatus = "NONE" | "ACTIVE" | "EXPIRING" | "EXPIRED";

export function subscriptionStatus(endsAt: Date | null, now = new Date()): SubscriptionStatus {
  if (!endsAt) return "NONE";
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0) return "EXPIRED";
  return remaining <= EXPIRING_SOON_DAYS * DAY_MS ? "EXPIRING" : "ACTIVE";
}

export function daysLeft(endsAt: Date, now = new Date()): number {
  return Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS);
}

/** Renewal stacks onto the remaining paid time; an expired subscription restarts from now. */
export function grantPeriod(currentEndsAt: Date | null, months: number, now = new Date()) {
  const startsAt = currentEndsAt && currentEndsAt > now ? currentEndsAt : now;
  return { startsAt, endsAt: extendAccess(startsAt, months) };
}

export function whatsappRenewUrl(organizationName?: string): string {
  const text = `Здравствуйте! Хочу продлить подписку Shanyraq AI${organizationName ? ` (${organizationName})` : ""}.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
