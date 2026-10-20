import { accessUntil, billingPlan } from "@/lib/billing/policy";

type Billing = { trialEndsAt: Date; paidUntil: Date | null; planId: string | null };
export type ManualGrant = { startsAt: Date; endsAt: Date; planId: string };

/** Independent entitlements form a union, never a sum or a replacement of paid time.
 * No billing row means rollout is disabled or the organization is grandfathered.
 * Overlapping active plans retain the larger existing capacity, not added capacities.
 */
export function effectiveSubscription(billing: Billing | null, grants: ManualGrant[], now = new Date()) {
  const activeGrants = grants.filter(grant => grant.startsAt <= now && grant.endsAt > now);
  const paidActive = Boolean(billing?.paidUntil && billing.paidUntil > now);
  const trialActive = Boolean(billing && billing.trialEndsAt > now);
  const candidates = [...activeGrants.map(grant => billingPlan(grant.planId)),
    paidActive && billing?.planId ? billingPlan(billing.planId) : undefined,
  ].filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));
  const plan = candidates.sort((a, b) => b.rooms - a.rooms)[0] ?? null;
  const deadlines = [...activeGrants.map(grant => grant.endsAt), ...(billing ? [accessUntil(billing)] : [])];
  const endsAt = deadlines.length ? new Date(Math.max(...deadlines.map(date => date.getTime()))) : null;
  return {
    writeAllowed: !billing || paidActive || trialActive || activeGrants.length > 0,
    unrestricted: !billing,
    paidActive, trialActive, manualActive: activeGrants.length > 0,
    endsAt, planId: plan?.id ?? null, roomLimit: plan?.rooms ?? null,
  };
}
