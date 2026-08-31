import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { billingLaunch } from "./config";
import { accessUntil, BillingError, billingPlan, extendAccess, isExpired, TRIAL_MS } from "./policy";
import { amountInMinorUnits, type PaymentFields } from "./freedompay";

/** Old organizations are explicitly grandfathered; switching hotels never starts a new trial. */
export async function getSubscription(organizationId: string) {
  const launch = billingLaunch();
  if (!launch) return null;
  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { createdAt: true } });
  if (organization.createdAt < launch) return null;
  return db.billingSubscription.upsert({
    where: { organizationId }, update: {},
    create: { organizationId, trialStartsAt: organization.createdAt, trialEndsAt: new Date(organization.createdAt.getTime() + TRIAL_MS) },
  });
}

export async function assertBillingWriteAccess(organizationId: string) {
  const subscription = await getSubscription(organizationId);
  if (subscription && isExpired(subscription)) throw new BillingError("Период доступа завершён. Доступен просмотр данных. Оплатите подписку в разделе «Подписка и оплата», чтобы сохранить изменения.");
}

export async function lockBillingOrganization(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
}

export async function assertRoomCapacity(tx: Prisma.TransactionClient, hotelId: string) {
  if (!billingLaunch()) return;
  const hotel = await tx.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { orgId: true } });
  if (!hotel.orgId) throw new BillingError("Организация не найдена");
  await lockBillingOrganization(tx, hotel.orgId);
  const subscription = await tx.billingSubscription.findUnique({ where: { organizationId: hotel.orgId } });
  const plan = subscription?.planId ? billingPlan(subscription.planId) : null;
  if (!plan) return;
  const count = await tx.room.count({ where: { hotel: { orgId: hotel.orgId } } });
  if (count >= plan.rooms) throw new BillingError(`Тариф ${plan.name}: не более ${plan.rooms} номеров в организации. Удалите лишние номера или измените тариф после окончания оплаченного периода.`);
}

export function matchesPayment(order: { id: string; providerPaymentId: string | null; amountMinor: number; currency: string; testMode: boolean }, fields: PaymentFields) {
  return fields.pg_order_id === order.id && fields.pg_payment_id === order.providerPaymentId &&
    amountInMinorUnits(fields.pg_amount ?? "") === order.amountMinor && fields.pg_currency === order.currency &&
    fields.pg_testing_mode === (order.testMode ? "1" : "0");
}

/** Lock the organization before the order so concurrent payments and duplicate callbacks cannot double-extend access. */
export async function applyPaymentResult(fields: PaymentFields) {
  const order = await db.billingPayment.findUnique({ where: { id: fields.pg_order_id ?? "" } });
  if (!order || !matchesPayment(order, fields)) throw new Error("Payment does not match order");
  if (!["0", "1", "2"].includes(fields.pg_result)) throw new Error("Invalid payment result");
  // Authorization alone is not a captured card payment. Configure single-stage acquiring.
  if (fields.pg_result === "1" && (fields.pg_captured === "0" || (fields.pg_payment_method === "bankcard" && fields.pg_captured !== "1"))) throw new Error("Payment not captured");
  return db.$transaction(async (tx) => {
    await lockBillingOrganization(tx, order.organizationId);
    const current = await tx.billingPayment.findUniqueOrThrow({ where: { id: order.id } });
    if (!matchesPayment(current, fields)) throw new Error("Payment does not match order");
    if (current.status === "SUCCEEDED") return;
    if (fields.pg_result === "2") return;
    if (fields.pg_result === "0") {
      await tx.billingPayment.update({ where: { id: order.id }, data: { status: "FAILED" } });
      return;
    }
    const now = new Date();
    if (!order.testMode) {
      const subscription = await tx.billingSubscription.findUniqueOrThrow({ where: { organizationId: order.organizationId } });
      if (subscription.paidUntil && subscription.paidUntil > now && subscription.planId !== order.planId) throw new Error("Conflicting paid plans require review");
      const base = new Date(Math.max(now.getTime(), accessUntil(subscription).getTime()));
      await tx.billingSubscription.update({
        where: { organizationId: order.organizationId },
        data: { planId: order.planId, paidUntil: extendAccess(base, order.months) },
      });
    }
    await tx.billingPayment.update({ where: { id: order.id }, data: { status: "SUCCEEDED", paidAt: now, checkoutUrl: null } });
  });
}
