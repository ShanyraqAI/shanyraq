import "server-only";

import { db } from "@/lib/db";
import { subscriptionStatus, type SubscriptionStatus } from "./access";

/** Latest grant decides current access; null means none was issued or the lookup failed (the banner must never break the dashboard). */
export async function getOrganizationSubscription(organizationId: string) {
  try {
    const grant = await db.subscriptionGrant.findFirst({ where: { organizationId }, orderBy: { endsAt: "desc" }, select: { planId: true, endsAt: true } });
    if (!grant) return null;
    return { planId: grant.planId, endsAt: grant.endsAt, status: subscriptionStatus(grant.endsAt) };
  } catch (error) {
    console.error("Subscription lookup failed", { organizationId, error });
    return null;
  }
}

export async function listSubscriptionOrganizations() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { hotels: true } },
      memberships: { where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, take: 1, select: { user: { select: { fullName: true, email: true, phone: true } } } },
      subscriptionGrants: { orderBy: { endsAt: "desc" }, take: 1, select: { planId: true, endsAt: true, note: true } },
    },
  });
  const now = new Date();
  return organizations.map((org) => {
    const grant = org.subscriptionGrants[0] ?? null;
    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      hotelCount: org._count.hotels,
      owner: org.memberships[0]?.user ?? null,
      planId: grant?.planId ?? null,
      endsAt: grant?.endsAt ?? null,
      note: grant?.note ?? null,
      status: subscriptionStatus(grant?.endsAt ?? null, now) as SubscriptionStatus,
    };
  });
}
