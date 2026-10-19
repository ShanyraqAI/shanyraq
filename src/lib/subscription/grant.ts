import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lockBillingOrganization } from "@/lib/billing/service";
import { grantPeriod } from "./access";

export async function grantSubscription(input: { organizationId: string; planId: string; months: number; note?: string | null; grantedById?: string | null }, client?: Prisma.TransactionClient) {
  const work = async (tx: Prisma.TransactionClient) => {
    const organization = await tx.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
    if (!organization) throw new Error("Организация не найдена");
    await lockBillingOrganization(tx, input.organizationId);
    const latest = await tx.subscriptionGrant.findFirst({ where: { organizationId: input.organizationId }, orderBy: { endsAt: "desc" } });
    const { startsAt, endsAt } = grantPeriod(latest?.endsAt ?? null, input.months);
    await tx.subscriptionGrant.create({
      data: { organizationId: input.organizationId, planId: input.planId, months: input.months, startsAt, endsAt, note: input.note ?? null, grantedById: input.grantedById ?? null },
    });
    return { endsAt };
  };
  return client ? work(client) : db.$transaction(work);
}

export async function endSubscription(organizationId: string, client?: Prisma.TransactionClient) {
  const now = new Date();
  const work = async (tx: Prisma.TransactionClient) => {
    await lockBillingOrganization(tx, organizationId);
    await tx.subscriptionGrant.updateMany({ where: { organizationId, endsAt: { gt: now } }, data: { endsAt: now } });
  };
  return client ? work(client) : db.$transaction(work);
}
