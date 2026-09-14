import { redirect } from "next/navigation";
import { History, Search, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentHotel, getCurrentMembership } from "@/lib/tenant";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTIVITY_TYPES, activitySummary, auditChanges, parseAuditPayload } from "@/lib/activity";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const [membership, hotel, filters] = await Promise.all([getCurrentMembership(), getCurrentHotel(), searchParams]);
  if (!membership || !hotel) redirect("/login");
  if (membership.role !== "OWNER") redirect("/dashboard");
  const query = filters.q?.trim().slice(0, 80) ?? "";
  const type = ACTIVITY_TYPES.some((item) => item.value === filters.type) ? filters.type! : "";
  const logs = await db.auditLog.findMany({
    where: {
      hotelId: hotel.id,
      ...(type ? { action: { startsWith: type } } : {}),
      ...(query ? {
        OR: [
          { action: { contains: query, mode: "insensitive" as const } },
          { entity: { contains: query, mode: "insensitive" as const } },
          { metaJson: { contains: query, mode: "insensitive" as const } },
          { actorUser: { fullName: { contains: query, mode: "insensitive" as const } } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actorUser: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Журнал действий" description="Кто, что и когда изменил в отеле — с предыдущими и новыми значениями." />
      <form className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row" method="get">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" defaultValue={query} placeholder="Сотрудник, номер брони или действие" className="pl-9" /></div>
        <select name="type" defaultValue={type} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">Все события</option>
          {ACTIVITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <Button type="submit">Найти</Button>
      </form>
      {logs.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {logs.map((log) => {
            const meta = parseAuditPayload(log.metaJson);
            const changes = auditChanges(parseAuditPayload(log.oldValueJson), parseAuditPayload(log.newValueJson));
            return (
              <article key={log.id} className="grid gap-4 border-b p-5 last:border-b-0 md:grid-cols-[170px_1fr]">
                <div className="text-sm">
                  <time className="font-semibold">{formatAuditTime(log.createdAt, hotel.timezone)}</time>
                  <p className="mt-1 flex items-center gap-1.5 text-muted-foreground"><UserRound className="size-3.5" />{log.actorUser?.fullName ?? "Система"}</p>
                </div>
                <div className="min-w-0">
                  <h2 className="font-medium first-letter:uppercase">{activitySummary(log.action, log.entityId, meta)}</h2>
                  {changes.length ? (
                    <dl className="mt-3 grid gap-x-5 gap-y-2 rounded-lg bg-secondary/45 p-3 text-sm sm:grid-cols-2">
                      {changes.map((change) => <div key={change.key} className="min-w-0"><dt className="text-xs text-muted-foreground">{change.label}</dt><dd className="mt-0.5 break-words"><span className="text-muted-foreground line-through decoration-muted-foreground/50">{change.oldValue}</span><span className="mx-2 text-muted-foreground">→</span><span className="font-medium">{change.newValue}</span></dd></div>)}
                    </dl>
                  ) : Object.keys(meta).length ? <p className="mt-2 text-sm text-muted-foreground">{formatMeta(meta)}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : <EmptyState icon={History} title="События не найдены" description="Измените фильтры или вернитесь позже — новые действия появятся здесь автоматически." />}
      {logs.length === 100 ? <p className="text-center text-xs text-muted-foreground">Показаны последние 100 событий по выбранному фильтру.</p> : null}
    </div>
  );
}

function formatAuditTime(value: Date, timezone: string): string {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now.getTime() - 86_400_000));
  const time = new Intl.DateTimeFormat("ru-RU", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(value);
  if (date === today) return `Сегодня, ${time}`;
  if (date === yesterday) return `Вчера, ${time}`;
  return new Intl.DateTimeFormat("ru-RU", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatMeta(meta: Record<string, unknown>): string {
  return Object.entries(meta).filter(([key]) => !["reference", "externalId"].includes(key)).map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}
