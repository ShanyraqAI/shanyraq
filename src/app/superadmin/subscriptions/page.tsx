import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/superadmin/auth";
import { listSubscriptionOrganizations } from "@/lib/subscription/queries";
import { billingPlan, BILLING_PLANS } from "@/lib/billing/policy";
import { daysLeft, type SubscriptionStatus } from "@/lib/subscription/access";
import { GrantSubscriptionForm } from "@/components/superadmin/grant-subscription-form";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Asia/Almaty" });
const STATUS_LABELS: Record<SubscriptionStatus, string> = { ACTIVE: "Активна", EXPIRING: "Скоро закончится", EXPIRED: "Истекла", NONE: "Нет подписки" };
const STATUS_CLASSES: Record<SubscriptionStatus, string> = {
  ACTIVE: "bg-emerald-400/15 text-emerald-300",
  EXPIRING: "bg-amber-400/15 text-amber-200",
  EXPIRED: "bg-red-400/15 text-red-300",
  NONE: "bg-white/10 text-slate-300",
};
const FILTERS: Array<[string, string]> = [["", "Все"], ["ACTIVE", "Активные"], ["EXPIRING", "Скоро закончатся"], ["EXPIRED", "Истекшие"], ["NONE", "Без подписки"]];

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const filter = FILTERS.some(([value]) => value === params.status) ? params.status ?? "" : "";
  const query = (params.q ?? "").trim().toLowerCase().slice(0, 100);
  const organizations = await listSubscriptionOrganizations();

  const count = (status: SubscriptionStatus) => organizations.filter((org) => org.status === status).length;
  const paying = organizations.filter((org) => org.status === "ACTIVE" || org.status === "EXPIRING");
  const cards: Array<[string, number, string]> = [
    ["С подпиской", paying.length, `из ${organizations.length} аккаунтов`],
    ["Скоро закончатся", count("EXPIRING"), "≤ 7 дней"],
    ["Истекли", count("EXPIRED"), "Нужно продление"],
    ["Без подписки", count("NONE"), "Подписка не выдавалась"],
    ...BILLING_PLANS.map((plan): [string, number, string] => [`Тариф ${plan.name}`, paying.filter((org) => org.planId === plan.id).length, "активных"]),
  ];

  const rows = organizations.filter((org) => {
    if (filter && org.status !== filter) return false;
    if (!query) return true;
    return [org.name, org.owner?.fullName, org.owner?.email, org.owner?.phone].some((value) => value?.toLowerCase().includes(query));
  });
  const href = (status: string) => `/superadmin/subscriptions${status ? `?status=${status}` : ""}`;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Подписки</h1>
        <p className="mt-2 text-sm text-slate-400">Выдавайте и продлевайте тариф для аккаунта. Продление ручного гранта добавляется к его оставшемуся сроку. Отмена гранта не затрагивает оплату.</p>
      </div>

      <section aria-label="Сводка" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note]) => (
          <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-2">
            {FILTERS.map(([value, label]) => (
              <Link key={value} href={href(value)} className={`rounded-full px-3 py-1 text-sm ${filter === value ? "bg-emerald-400 text-slate-950" : "bg-white/10 text-slate-300 hover:bg-white/15"}`}>{label}</Link>
            ))}
          </nav>
          <form className="flex gap-2">
            {filter ? <input type="hidden" name="status" value={filter} /> : null}
            <input name="q" defaultValue={params.q ?? ""} placeholder="Имя, email, телефон" className="h-9 w-56 rounded-md border border-white/15 bg-slate-900 px-3 text-sm" />
          </form>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="border-white/10 hover:bg-transparent">
              {["Аккаунт / владелец", "Контакты", "Статус", "Тариф", "Действует до", "Выдать"].map((title) => <TableHead key={title} className="text-slate-400">{title}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((org) => (
                <TableRow key={org.id} className="border-white/10 hover:bg-white/[0.04]">
                  <TableCell><div className="font-medium text-white">{org.owner?.fullName ?? org.name}</div><div className="text-xs text-slate-500">{org.name} · объектов: {org.hotelCount} · с {dateFormat.format(org.createdAt)}</div></TableCell>
                  <TableCell className="text-xs text-slate-400"><div>{org.owner?.email ?? "—"}</div><div>{org.owner?.phone ?? ""}</div></TableCell>
                  <TableCell><Badge className={STATUS_CLASSES[org.status]}>{STATUS_LABELS[org.status]}</Badge></TableCell>
                  <TableCell>{org.planId ? billingPlan(org.planId)?.name ?? org.planId : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{org.endsAt ? <>{dateFormat.format(org.endsAt)}<div className="text-xs text-slate-500">{org.status === "EXPIRED" ? "истекла" : `осталось ${daysLeft(org.endsAt)} дн.`}</div></> : "—"}</TableCell>
                  <TableCell><GrantSubscriptionForm organizationId={org.id} defaultPlan={org.planId} canEnd={org.canEndGrant} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Ничего не найдено.</p> : null}
      </section>
    </main>
  );
}
