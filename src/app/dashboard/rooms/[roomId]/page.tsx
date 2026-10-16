import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { hasHotelPermission } from "@/lib/access";
import { getRequestLocale } from "@/lib/locale-server";
import { requireSectionAccess } from "@/server/guards";
import { formatMoney } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { RoomStatus } from "@/lib/constants";
import { TTLockWorkspace } from "@/components/ttlock/ttlock-workspace";

export const dynamic = "force-dynamic";

export default async function ApartmentProfilePage({ params }: { params: Promise<{ roomId: string }> }) {
  await requireSectionAccess("ROOMS");
  const member = await getCurrentMembership();
  if (!member) notFound();
  const { roomId } = await params;
  const [room, locale] = await Promise.all([
    db.room.findFirst({ where: { id: roomId, hotelId: member.hotelId }, include: { roomType: { select: { name: true, capacity: true, basePrice: true } } } }),
    getRequestLocale(),
  ]);
  if (!room) notFound();
  const kk = locale === "kk";
  const details = [
    [kk ? "Түрі" : "Тип", room.roomType.name],
    [kk ? "Қабат" : "Этаж", room.floor],
    [kk ? "Сыйымдылық" : "Вместимость", room.roomType.capacity],
    [kk ? "Түндік баға" : "Цена за ночь", formatMoney(Number(room.roomType.basePrice))],
    [kk ? "Күйі" : "Статус", t.statuses.room[room.status as RoomStatus]],
  ];
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/dashboard/rooms" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />{kk ? "Барлық пәтер" : "Все квартиры"}</Link>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs text-muted-foreground">{kk ? "Пәтер профилі" : "Профиль квартиры"}</p><h1 className="mt-1 text-2xl font-semibold">{kk ? "Пәтер" : "Квартира"} {room.number}</h1></div>
      {hasHotelPermission(member, "CALENDAR") && <Link href={`/dashboard/rooms/${encodeURIComponent(room.id)}/calendar`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium"><CalendarDays className="size-4" />{kk ? "Күнтізбе және брондау" : "Календарь и бронирование"}</Link>}
    </header>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-5">{details.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl>
    <TTLockWorkspace roomId={room.id} />
  </div>;
}
