import "server-only";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { BILLING_PLANS, billingPlan } from "@/lib/billing/policy";
import { daysLeft, GRANT_MONTHS, subscriptionStatus, type SubscriptionStatus } from "@/lib/subscription/access";
import { endSubscription, grantSubscription } from "@/lib/subscription/grant";
import { listSubscriptionOrganizations } from "@/lib/subscription/queries";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Asia/Almaty" });
const STATUS_ICON: Record<SubscriptionStatus, string> = { ACTIVE: "🟢", EXPIRING: "🟡", EXPIRED: "🔴", NONE: "⚪" };
const MAX_LIST = 25;

export function adminIds(): Set<string> {
  return new Set((process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
}

export const esc = (value: string) => value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);

type Org = Awaited<ReturnType<typeof listSubscriptionOrganizations>>[number];

/** Short id shown in lists; the last 6 chars of a cuid are enough to be unique in practice. */
const shortId = (org: Org) => org.id.slice(-6);

function line(org: Org): string {
  const plan = org.planId ? billingPlan(org.planId)?.name ?? org.planId : "—";
  const until = org.endsAt ? `до ${dateFormat.format(org.endsAt)}${org.status === "EXPIRED" ? "" : ` (${daysLeft(org.endsAt)} дн.)`}` : "нет подписки";
  return `${STATUS_ICON[org.status]} <b>${esc(org.owner?.fullName ?? org.name)}</b> · ${esc(plan)} · ${until}\n   <code>${shortId(org)}</code> ${esc(org.owner?.email ?? org.owner?.phone ?? "")}`;
}

function list(title: string, orgs: Org[]): string {
  if (!orgs.length) return `${title}: никого нет.`;
  const shown = orgs.slice(0, MAX_LIST).map(line).join("\n");
  return `<b>${title}</b> (${orgs.length})\n${shown}${orgs.length > MAX_LIST ? `\n…и ещё ${orgs.length - MAX_LIST}. Уточните поиском: /find` : ""}`;
}

function matchOrgs(orgs: Org[], query: string): Org[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return orgs.filter((org) => org.id.endsWith(q) || [org.name, org.owner?.fullName, org.owner?.email, org.owner?.phone].some((value) => value?.toLowerCase().includes(q)));
}

const HELP = `<b>Shanyraq Control</b>
/stats — пользователи, подписки, тарифы
/subs — все аккаунты с подпиской
/expiring — заканчиваются за 7 дней
/expired — истекшие
/find <i>текст</i> — поиск по имени, email, телефону, id
/grant <i>id|email</i> <i>тариф</i> <i>месяцев</i> — выдать или продлить
/end <i>id|email</i> — завершить подписку
Тарифы: ${BILLING_PLANS.map((plan) => plan.id).join(", ")}. Месяцы: ${GRANT_MONTHS.join(", ")}.`;

async function stats(): Promise<string> {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const [orgs, users, newToday, newWeek, hotels, reservations] = await Promise.all([
    listSubscriptionOrganizations(),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: day } } }),
    db.user.count({ where: { createdAt: { gte: week } } }),
    db.hotel.count(),
    db.reservation.count(),
  ]);
  const by = (status: SubscriptionStatus) => orgs.filter((org) => org.status === status).length;
  const paying = orgs.filter((org) => org.status === "ACTIVE" || org.status === "EXPIRING");
  return [
    "<b>📊 Статистика</b>",
    `Пользователей: <b>${users}</b> (сегодня +${newToday}, за 7 дн. +${newWeek})`,
    `Объектов: ${hotels} · Броней: ${reservations}`,
    "",
    `<b>Подписки</b> (аккаунтов: ${orgs.length})`,
    `🟢 Активные: ${by("ACTIVE")}`,
    `🟡 Скоро закончатся: ${by("EXPIRING")}`,
    `🔴 Истекшие: ${by("EXPIRED")}`,
    `⚪ Без подписки: ${by("NONE")}`,
    "",
    ...BILLING_PLANS.map((plan) => `${plan.name}: ${paying.filter((org) => org.planId === plan.id).length}`),
  ].join("\n");
}

async function resolveOne(orgs: Org[], query: string): Promise<Org | string> {
  const found = matchOrgs(orgs, query);
  if (found.length === 0) return "Аккаунт не найден.";
  if (found.length > 1) return `Найдено ${found.length}, уточните (id или email):\n${found.slice(0, 10).map(line).join("\n")}`;
  return found[0];
}

export async function handleCommand(text: string, actor: string, tx?: Prisma.TransactionClient): Promise<string> {
  const [rawCommand = "", ...args] = text.trim().split(/\s+/);
  const command = rawCommand.split("@")[0].toLowerCase();
  switch (command) {
    case "/start":
    case "/help":
      return HELP;
    case "/stats":
      return stats();
    case "/subs": {
      const orgs = await listSubscriptionOrganizations();
      return list("Аккаунты с подпиской", orgs.filter((org) => org.status === "ACTIVE" || org.status === "EXPIRING").sort((a, b) => a.endsAt!.getTime() - b.endsAt!.getTime()));
    }
    case "/expiring": {
      const orgs = await listSubscriptionOrganizations();
      return list("Заканчиваются за 7 дней", orgs.filter((org) => org.status === "EXPIRING").sort((a, b) => a.endsAt!.getTime() - b.endsAt!.getTime()));
    }
    case "/expired": {
      const orgs = await listSubscriptionOrganizations();
      return list("Истекшие", orgs.filter((org) => org.status === "EXPIRED"));
    }
    case "/find": {
      const found = matchOrgs(await listSubscriptionOrganizations(), args.join(" "));
      return found.length ? list("Найдено", found) : "Ничего не найдено. Пример: /find ivan@mail.ru";
    }
    case "/grant": {
      const [query, planId, monthsRaw] = args;
      const months = Number(monthsRaw);
      if (!query || !planId || !billingPlan(planId) || !(GRANT_MONTHS as readonly number[]).includes(months)) return "Формат: /grant <id|email> <start|pro|business> <1|3|6|12>";
      const org = await resolveOne(await listSubscriptionOrganizations(), query);
      if (typeof org === "string") return org;
      const { endsAt } = await grantSubscription({ organizationId: org.id, planId, months, note: `Telegram: ${actor}` }, tx);
      return `✅ ${esc(org.owner?.fullName ?? org.name)}: ${billingPlan(planId)!.name}, +${months} мес. Действует до ${dateFormat.format(endsAt)}.`;
    }
    case "/end": {
      if (!args[0]) return "Формат: /end <id|email>";
      const org = await resolveOne(await listSubscriptionOrganizations(), args[0]);
      if (typeof org === "string") return org;
      if (subscriptionStatus(org.endsAt) === "EXPIRED" || !org.endsAt) return "У аккаунта нет действующей подписки.";
      await endSubscription(org.id, tx);
      return `⛔ Подписка ${esc(org.owner?.fullName ?? org.name)} завершена.`;
    }
    default:
      return "Неизвестная команда.\n\n" + HELP;
  }
}
