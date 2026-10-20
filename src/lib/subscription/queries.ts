import "server-only";

import { db } from "@/lib/db";
import { effectiveSubscription } from "./effective";
import { subscriptionStatus, type SubscriptionStatus } from "./access";

export async function listSubscriptionOrganizations(client: Pick<typeof db, "organization"> = db) {
  const organizations = await client.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { hotels: true } },
      memberships: { where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, take: 1, select: { user: { select: { fullName: true, email: true, phone: true } } } },
      billingSubscription: { select: { planId: true, trialEndsAt: true, paidUntil: true } },
      subscriptionGrants: { orderBy: { endsAt: "desc" }, select: { planId: true, startsAt: true, endsAt: true, note: true } },
    },
  });
  const now = new Date();
  return organizations.map((org) => {
    const grant = org.subscriptionGrants[0] ?? null;
    const access = effectiveSubscription(org.billingSubscription, org.subscriptionGrants, now);
    const endsAt = access.endsAt ?? grant?.endsAt ?? null;
    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      hotelCount: org._count.hotels,
      owner: org.memberships[0]?.user ?? null,
      planId: access.planId ?? grant?.planId ?? null,
      endsAt,
      canEndGrant: org.subscriptionGrants.some(item => item.endsAt > now),
      note: grant?.note ?? null,
      status: subscriptionStatus(endsAt, now) as SubscriptionStatus,
    };
  });
}
