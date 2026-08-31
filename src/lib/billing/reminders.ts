import { db } from "@/lib/db";
import { billingLaunch, paymentConfig } from "./config";
import { accessUntil, DAY_MS, reminderKind } from "./policy";

/** Daily best-effort email reminders; request-time access checks do not depend on this job. */
export async function sendBillingReminders() {
  if (!billingLaunch()) return { skipped: "billing-disabled", sent: 0 };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const config = paymentConfig();
  if (!apiKey || !from || !config) return { skipped: "email-not-configured", sent: 0 };
  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * DAY_MS);
  // Overdue notices are bounded to the last 7 days; the in-app notice has no such limit.
  const oldest = new Date(now.getTime() - 7 * DAY_MS);
  const subscriptions = await db.billingSubscription.findMany({
    where: { OR: [{ paidUntil: { gte: oldest, lte: horizon } }, { paidUntil: null, trialEndsAt: { gte: oldest, lte: horizon } }] },
    include: { organization: { select: { memberships: { where: { role: "OWNER", user: { emailVerifiedAt: { not: null }, email: { not: null } } }, select: { user: { select: { id: true, email: true } } } } } } },
    orderBy: { trialEndsAt: "desc" }, take: 500,
  });
  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    const end = accessUntil(subscription);
    const kind = reminderKind(end, now);
    if (!kind) continue;
    const recipients = new Map(subscription.organization.memberships.map((item) => [item.user.id, item.user.email!]));
    for (const [userId, email] of recipients) {
      const notice = await db.billingNotice.upsert({
        where: { organizationId_userId_kind_periodEnd: { organizationId: subscription.organizationId, userId, kind, periodEnd: end } },
        create: { organizationId: subscription.organizationId, userId, kind, periodEnd: end }, update: {},
      });
      if (notice.sentAt) continue;
      const claimed = await db.billingNotice.updateMany({
        where: { id: notice.id, sentAt: null, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
        data: { leaseUntil: new Date(Date.now() + 120_000) },
      });
      if (!claimed.count) continue;
      try {
        const current = await db.billingSubscription.findUniqueOrThrow({ where: { organizationId: subscription.organizationId } });
        if (accessUntil(current).getTime() !== end.getTime()) continue;
        const deadline = new Intl.DateTimeFormat("ru-KZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" }).format(end);
        const subject = kind === "expired" ? "Shanyraq AI: период доступа завершён" : "Shanyraq AI: период доступа скоро завершится";
        const text = `${kind === "expired" ? "Период доступа завершился" : "Период доступа завершается"} ${deadline} (время Казахстана). После окончания доступен просмотр данных; для сохранения изменений оплатите подписку. Подключённые каналы не отключаем. Автоматических списаний нет.\n\nПодписка и оплата: ${config.origin}/dashboard/billing`;
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `billing-${notice.id}` },
          body: JSON.stringify({ from, to: [email], subject, text }), signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("Email rejected");
        await db.billingNotice.update({ where: { id: notice.id }, data: { sentAt: new Date() } });
        sent++;
      } catch {
        failed++;
        console.error("Billing reminder failed", { noticeId: notice.id });
      } finally {
        await db.billingNotice.update({ where: { id: notice.id }, data: { leaseUntil: null } });
      }
      if (Date.now() - now.getTime() > 45_000) return { sent, failed, more: true };
    }
  }
  return { sent, failed, more: subscriptions.length === 500 };
}
