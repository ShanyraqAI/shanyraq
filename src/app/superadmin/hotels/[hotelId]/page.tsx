import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getSuperAdminHotel } from "@/lib/superadmin/queries";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default async function SuperAdminHotelPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const hotel = await getSuperAdminHotel(hotelId);
  if (!hotel) notFound();
  const counts = [
    ["Номера", hotel._count.rooms], ["Типы номеров", hotel._count.roomTypes], ["Бронирования", hotel._count.reservations], ["Гости", hotel._count.guests], ["Каналы", hotel._count.connections],
  ] as const;

  return (
    <main className="space-y-7">
      <Link href="/superadmin" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="size-4" />К обзору</Link>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Hotel detail</p><h1 className="text-3xl font-semibold tracking-tight">{hotel.name}</h1><p className="mt-2 text-sm text-slate-400">{[hotel.propertyType, hotel.city, hotel.country].filter(Boolean).join(" · ") || "Локация не заполнена"}</p></div>
        <Badge className="w-fit bg-emerald-400 text-slate-950">{hotel.currency} · {hotel.timezone}</Badge>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{counts.map(([label, value]) => <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p></article>)}</section>
      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-center gap-3"><Building2 className="size-5 text-emerald-400" /><div><h2 className="font-semibold">Команда</h2><p className="text-xs text-slate-500">{hotel.organization.name}</p></div></div>
          <Table><TableHeader><TableRow className="border-white/10 hover:bg-transparent"><TableHead className="text-slate-400">Пользователь</TableHead><TableHead className="text-slate-400">Роль</TableHead><TableHead className="text-slate-400">Доступ</TableHead></TableRow></TableHeader><TableBody>{hotel.memberships.map((membership) => <TableRow key={`${membership.user.id}-${membership.createdAt.toISOString()}`} className="border-white/10 hover:bg-white/[0.04]"><TableCell><div className="text-white">{membership.user.fullName}</div><div className="text-xs text-slate-500">{membership.user.email ?? membership.user.phone ?? "Контакт не указан"}</div></TableCell><TableCell>{membership.role}</TableCell><TableCell>{membership.accessLevel}</TableCell></TableRow>)}</TableBody></Table>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4"><h2 className="font-semibold">Последние события</h2><p className="text-xs text-slate-500">Без гостевых данных и метаданных</p></div>
          <div className="max-h-[480px] space-y-2 overflow-y-auto">{hotel.analyticsEvents.map((event) => <div key={event.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3"><div className="min-w-0"><p className="truncate text-sm text-slate-200">{event.eventType}</p><p className="truncate text-xs text-slate-500">{event.user?.fullName ?? "Системное событие"}{event.entityType ? ` · ${event.entityType}` : ""}</p></div><time className="shrink-0 text-xs text-slate-500">{dateTimeFormatter.format(event.occurredAt)}</time></div>)}</div>
          {hotel.analyticsEvents.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Событий пока нет.</p>}
        </article>
      </section>
    </main>
  );
}
