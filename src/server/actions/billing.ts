"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { requirePaymentConfig } from "@/lib/billing/config";
import { BillingError, billingPlan } from "@/lib/billing/policy";
import { applyPaymentResult, getSubscription, lockBillingOrganization } from "@/lib/billing/service";
import { fetchPaymentStatus, initializePayment } from "@/lib/billing/freedompay";

export async function createCheckoutAction(input: { planId: string; months: number; consent: boolean }) {
  try {
    const membership = await getCurrentMembership();
    if (!membership || membership.role !== "OWNER") throw new BillingError("Оплатить подписку может только владелец организации.");
    const plan = billingPlan(input?.planId);
    if (!plan || ![1, 12].includes(input?.months) || input.consent !== true) throw new BillingError("Выберите тариф, период и подтвердите разовую оплату.");
    const config = requirePaymentConfig();
    const testMode = config.mode === "test";
    const subscription = await getSubscription(membership.organizationId);
    if (!testMode && !subscription) throw new BillingError("Ваш текущий доступ сохранён. Платная подписка для этого аккаунта пока не требуется.");
    const order = await db.$transaction(async (tx) => {
      await lockBillingOrganization(tx, membership.organizationId);
      const now = new Date();
      const current = await tx.billingSubscription.findUnique({ where: { organizationId: membership.organizationId } });
      if (current?.paidUntil && current.paidUntil > now && current.planId !== plan.id) throw new BillingError("До окончания оплаченного периода можно продлить только текущий тариф.");
      const roomCount = await tx.room.count({ where: { hotel: { orgId: membership.organizationId } } });
      if (roomCount > plan.rooms) throw new BillingError(`В организации ${roomCount} номеров. Выберите тариф с достаточным лимитом.`);
      let existing = await tx.billingPayment.findFirst({
        where: { organizationId: membership.organizationId, status: { in: ["CREATED", "PENDING"] }, testMode },
        orderBy: { createdAt: "desc" },
      });
      // Initialization never yielded a checkout URL, so the customer could not have paid this abandoned attempt.
      if (existing?.status === "CREATED" && !existing.providerPaymentId && existing.expiresAt <= now) {
        await tx.billingPayment.update({ where: { id: existing.id }, data: { status: "FAILED" } });
        existing = null;
      }
      if (existing) {
        if (existing.expiresAt <= now) throw new BillingError("Сначала проверьте статус предыдущего счёта в истории платежей. Не оплачивайте повторно, если деньги уже списаны.");
        if (existing.planId !== plan.id || existing.months !== input.months) throw new BillingError("Уже открыт другой счёт. Завершите его оплату или дождитесь окончания срока действия — 30 минут.");
        if (!existing.checkoutUrl) throw new BillingError("Счёт создаётся. Подождите несколько секунд и попробуйте снова.");
        return { payment: existing, reused: true };
      }
      const recentCount = await tx.billingPayment.count({ where: { organizationId: membership.organizationId, createdAt: { gt: new Date(now.getTime() - 3_600_000) } } });
      if (recentCount >= 10) throw new BillingError("Слишком много попыток оплаты. Попробуйте через час.");
      const payment = await tx.billingPayment.create({ data: {
        organizationId: membership.organizationId, planId: plan.id, months: input.months,
        amountMinor: plan.monthlyKzt * (input.months === 12 ? 10 : 1) * 100,
        testMode, expiresAt: new Date(now.getTime() + 30 * 60_000),
      } });
      return { payment, reused: false };
    });
    if (order.reused) return { ok: true as const, url: order.payment.checkoutUrl! };
    try {
      const initialized = await initializePayment({ ...order.payment, description: `Shanyraq AI ${plan.name}, ${input.months === 12 ? "1 год" : "1 месяц"}. Разовая оплата.` });
      await db.billingPayment.update({ where: { id: order.payment.id }, data: { ...initialized, status: "PENDING" } });
      return { ok: true as const, url: initialized.checkoutUrl };
    } catch {
      await db.billingPayment.update({ where: { id: order.payment.id }, data: { status: "FAILED" } });
      throw new Error("Checkout initialization failed");
    }
  } catch (error) {
    if (error instanceof BillingError) return { ok: false as const, error: error.message };
    const incident = randomUUID();
    console.error("Billing checkout failed", { incident });
    return { ok: false as const, error: `Не удалось открыть оплату. Попробуйте позже. Код обращения: ${incident}` };
  }
}

export async function checkPaymentAction(paymentId: string) {
  try {
    const membership = await getCurrentMembership();
    if (!membership || membership.role !== "OWNER" || typeof paymentId !== "string" || paymentId.length > 50) throw new BillingError("Платёж недоступен.");
    const order = await db.billingPayment.findFirst({ where: { id: paymentId, organizationId: membership.organizationId } });
    if (!order?.providerPaymentId) throw new BillingError("Счёт ещё не создан. Попробуйте позже.");
    if (order.status === "SUCCEEDED") return { ok: true as const, message: "Платёж уже подтверждён." };
    if (order.testMode !== (requirePaymentConfig().mode === "test")) throw new BillingError("Этот платёж создан в другом режиме. Обратитесь в поддержку.");
    const claimed = await db.billingPayment.updateMany({
      where: { id: order.id, organizationId: membership.organizationId, status: { not: "SUCCEEDED" }, updatedAt: { lt: new Date(Date.now() - 15_000) } },
      data: { updatedAt: new Date() },
    });
    if (!claimed.count) return { ok: true as const, message: "Статус недавно обновлён. Повторите проверку через 15 секунд." };
    const result = await fetchPaymentStatus(order.providerPaymentId);
    if (!["success", "failed"].includes(result.pg_payment_status)) return { ok: true as const, message: "Freedom Pay ещё не подтвердил завершение платежа. Не оплачивайте повторно, если деньги списаны." };
    await applyPaymentResult({ ...result, pg_order_id: result.pg_order_id || order.id, pg_testing_mode: result.pg_testing_mode ?? (order.testMode ? "1" : "0"), pg_result: result.pg_payment_status === "success" ? "1" : "0" });
    return { ok: true as const, message: result.pg_payment_status === "success" ? "Платёж подтверждён." : "Оплата не завершена. Можно открыть новый счёт." };
  } catch (error) {
    if (error instanceof BillingError) return { ok: false as const, error: error.message };
    const incident = randomUUID();
    console.error("Payment status check failed", { incident });
    return { ok: false as const, error: `Не удалось проверить платёж. Не оплачивайте повторно, если деньги списаны. Код обращения: ${incident}` };
  }
}
