import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSectionAccess } from "@/server/guards";
import { getCurrentMembership } from "@/lib/tenant";
import { getRequestLocale } from "@/lib/locale-server";
import { db } from "@/lib/db";
import { profileSchema } from "@/lib/communications/schema";
import { scopeOf } from "@/lib/communications/service";
import { ApartmentEditor } from "@/components/rooms/apartment-editor";
import type { RoomStatus } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default async function EditApartmentPage({ params }: { params: Promise<{ roomId: string }> }) {
  await requireSectionAccess("ROOMS");
  const m = await getCurrentMembership();
  // Existing profile/photo mutation policy: only the owner may change these data.
  if (!m || m.role !== "OWNER") notFound();
  const { roomId } = await params;
  const [room, locale] = await Promise.all([db.room.findFirst({ where: { id: roomId, hotelId: m.hotelId, hotel: { orgId: m.organizationId } }, include: { roomType: true, rentalProperty: true, communicationProfile: true, communicationPhotos: { where: { archivedAt: null }, orderBy: { position: "asc" }, select: { id: true, name: true, position: true } } } }), getRequestLocale()]);
  if (!room) notFound();
  return <div data-clarity-mask="true" className="mx-auto min-w-0 max-w-3xl space-y-5"><Link href={`/dashboard/rooms/${encodeURIComponent(room.id)}`} className="inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft className="size-4" />{locale === "kk" ? "Пәтерге оралу" : "Назад к квартире"}</Link><h1 className="break-words text-2xl font-semibold">{locale === "kk" ? "Пәтерді өзгерту" : "Редактирование квартиры"} · {room.number}</h1><ApartmentEditor locale={locale} scope={scopeOf(m)} room={{ id: room.id, number: room.number, floor: room.floor, status: room.status as RoomStatus, roomTypeId: room.roomTypeId, roomTypeName: room.roomType.name, capacity: room.roomType.capacity, basePrice: Number(room.roomType.basePrice), guestTonight: null }} communication={{ id: room.id, label: room.number, version: room.communicationProfile?.version ?? 0, profile: profileSchema.parse(room.communicationProfile ?? { publicName: `${room.rentalProperty.publicName} · ${room.number}`, address: room.rentalProperty.address ?? "" }), photos: room.communicationPhotos }} /></div>;
}
