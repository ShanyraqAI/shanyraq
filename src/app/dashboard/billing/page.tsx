import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { getSubscription, getEffectiveSubscription } from "@/lib/billing/service";
import { billingLaunch, paymentConfig } from "@/lib/billing/config";
import { billingPlan, BILLING_PLANS } from "@/lib/billing/policy";
import { BillingCheckout, PaymentStatusCheck } from "@/components/billing/billing-checkout";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";
const dateFormat = new Intl.DateTimeFormat("ru-KZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" });

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ payment?: string; plan?: string }> }) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  const [subscription, access] = await Promise.all([getSubscription(membership.organizationId), getEffectiveSubscription(membership.organizationId)]);
  const config = paymentConfig();
  const owner = membership.role === "OWNER";
  const params = await searchParams;
  const requestedPayment = typeof params.payment === "string" && params.payment.length <= 50 ? params.payment : null;
  const requestedPlan = BILLING_PLANS.some((item) => item.id === params.plan) ? params.plan! : null;
  const [roomCount, payments, payment] = await Promise.all([
    db.room.count({ where: { hotel: { orgId: membership.organizationId } } }),
    owner ? db.billingPayment.findMany({ where: { organizationId: membership.organizationId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, amountMinor: true, status: true, testMode: true, createdAt: true } }) : [],
    owner && requestedPayment ? db.billingPayment.findFirst({ where: { id: requestedPayment, organizationId: membership.organizationId }, select: { status: true, testMode: true } }) : null,
  ]);
  const enabled = Boolean(config && (config.mode === "test" || subscription));
  const currentPlan = subscription?.paidUntil && subscription.paidUntil > new Date() ? subscription.planId : null;
  const statuses: Record<string, string> = { CREATED: "Создаётся", PENDING: "Ожидает оплаты или подтверждения", SUCCEEDED: "Оплачен", FAILED: "Не завершён" };
  return <div className="space-y-6">
    <PageHeader title="Подписка и оплата" description="14 дней без карты. Затем — разовая оплата выбранного периода, без автопродления." />
    <section className="rounded-xl border bg-card p-6">
      <h2 className="font-semibold">{!access.writeAllowed ? "Доступен просмотр данных" : access.manualActive ? "Ручной доступ активен" : currentPlan ? `Тариф ${billingPlan(currentPlan)?.name ?? "Shanyraq AI"}` : subscription ? "Бесплатный период" : billingLaunch() ? "Текущий доступ сохранён" : "Онлайн-оплата готовится к запуску"}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{access.endsAt && !access.unrestricted ? `Доступ до ${dateFormat.format(access.endsAt)} (время Казахстана). После окончания данные сохраняются; изменения доступны при действующей оплате или ручном гранте. Подключённые каналы не отключаем.` : "Ваш аккаунт не заблокирован. Пока подключение Freedom Pay не завершено, оплачивать доступ и вводить карту не нужно."}</p>
    </section>
    {payment && <div role="status" className="rounded-lg border bg-accent p-4 text-sm">{payment.status === "SUCCEEDED" ? payment.testMode ? "Тестовый платёж подтверждён. Реальная подписка не изменена." : "Платёж подтверждён. Доступ продлён." : payment.status === "FAILED" ? "Платёж не завершён. Деньги не подтверждены провайдером; можно попробовать оплатить снова." : "Ожидаем подтверждения Freedom Pay. Возврат на эту страницу сам по себе не означает успешную оплату. Обновите страницу через несколько секунд."}</div>}
    {owner ? <BillingCheckout enabled={enabled} testMode={config?.mode === "test"} roomCount={roomCount} currentPlan={currentPlan} initialPlan={requestedPlan} /> : <p className="text-sm text-muted-foreground">Оплатить подписку может владелец организации. Обратитесь к нему для продления доступа.</p>}
    {owner && payments.length > 0 && <section className="rounded-xl border bg-card p-6"><h2 className="mb-4 font-semibold">Последние платежи</h2><ul className="divide-y">{payments.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{dateFormat.format(item.createdAt)}{item.testMode ? " · Тест" : ""}</span><span>{new Intl.NumberFormat("ru-KZ").format(item.amountMinor / 100)} ₸ · {statuses[item.status] ?? "Проверяется"}</span>{item.status === "PENDING" && <PaymentStatusCheck paymentId={item.id} />}</li>)}</ul></section>}
  </div>;
}
