import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { hasHotelPermission } from "@/lib/access";
import { todayInTimeZone } from "@/lib/dates";
import { RoomsGrid } from "@/components/rooms/rooms-grid";
import { requireSectionAccess } from "@/server/guards";
import { getRequestLocale } from "@/lib/locale-server";
import type { RoomStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";
export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ room?: string | string[]; status?: string | string[] }> }) {
  await requireSectionAccess("ROOMS");
  const member = await getCurrentMembership();
  if (!member) return null;
  const [locale, query, hotel] = await Promise.all([getRequestLocale(), searchParams, db.hotel.findUniqueOrThrow({ where: { id: member.hotelId }, select: { timezone: true, currency: true } })]);
  const kk = locale === "kk";
  const canReadPhotos = hasHotelPermission(member, "RESERVATIONS");
  const day = todayInTimeZone(hotel.timezone);
  const [types, raw, reservations] = await Promise.all([
    db.roomType.findMany({ where: { hotelId: member.hotelId }, orderBy: { sortOrder: "asc" } }),
    db.room.findMany({ where: { hotelId: member.hotelId }, include: { roomType: { select: { name: true, capacity: true, basePrice: true } }, communicationPhotos: { where: { organizationId: member.organizationId, hotelId: member.hotelId, archivedAt: null }, orderBy: [{ position: "asc" }, { id: "asc" }], take: canReadPhotos ? 1 : 0, select: { id: true } } }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }] }),
    canReadPhotos ? db.reservation.findMany({ where: { hotelId: member.hotelId, checkIn: { lte: day }, checkOut: { gt: day }, status: { in: ["CONFIRMED", "CHECKED_IN"] } }, select: { roomId: true, guest: { select: { fullName: true } } } }) : Promise.resolve([]),
  ]);
  const guests = new Map(reservations.map((item) => [item.roomId, item.guest.fullName]));
  const rooms = raw.map((room) => ({ id: room.id, number: room.number, floor: room.floor, status: room.status as RoomStatus, roomTypeId: room.roomTypeId, roomTypeName: room.roomType.name, capacity: room.roomType.capacity, basePrice: Number(room.roomType.basePrice), currency: hotel.currency, guestTonight: guests.get(room.id) ?? null, photoId: canReadPhotos ? room.communicationPhotos[0]?.id ?? null : null, photosRestricted: !canReadPhotos }));
  const filter = typeof query.status === "string" && ["AVAILABLE", "CLEANING", "REPAIR"].includes(query.status) ? query.status : "ALL";
  const filtered = rooms.filter((room) => filter === "ALL" || (filter === "REPAIR" ? ["MAINTENANCE", "OUT_OF_ORDER"].includes(room.status) : room.status === filter));
  const filters = [{ value: "ALL", label: kk ? "Барлығы" : "Все" }, { value: "AVAILABLE", label: kk ? "Дайын" : "Готовы" }, { value: "CLEANING", label: kk ? "Жинау" : "Уборка" }, { value: "REPAIR", label: kk ? "Жөндеу" : "Ремонт" }];
  const common = { roomTypes: types.map((type) => type.name), typeDetails: types.map((type) => ({ name: type.name, capacity: type.capacity, basePrice: Number(type.basePrice) })), locale };
  return <div className="space-y-5"><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{kk ? "Пәтерлер" : "Квартиры"}</h1><p className="mt-2 text-sm text-muted-foreground">{rooms.length} · {kk ? "Суреттер, бағалар және ағымдағы күй" : "Фотографии, цены и текущий статус"}</p></div><RoomsGrid rooms={[]} {...common} addButtonOnly /></header>
    <nav aria-label={kk ? "Пәтерлер сүзгісі" : "Фильтр квартир"} className="flex flex-wrap gap-2">{filters.map((item) => <Link key={item.value} href={item.value === "ALL" ? "/dashboard/rooms" : `/dashboard/rooms?status=${item.value}`} aria-current={item.value === filter ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold ${item.value === filter ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>{item.label}</Link>)}</nav>
    {filtered.length || !rooms.length ? <RoomsGrid rooms={filtered} {...common} highlightRoomId={typeof query.room === "string" ? query.room : undefined} /> : <p role="status" className="rounded-xl border p-6 text-base">{kk ? "Бұл сүзгіге сәйкес пәтер жоқ." : "Нет квартир с выбранным статусом."} <Link href="/dashboard/rooms" className="font-semibold underline">{kk ? "Барлығын көрсету" : "Показать все"}</Link></p>}
  </div>;
}
