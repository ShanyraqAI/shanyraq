/* eslint-disable @next/next/no-img-element -- private authenticated photos must not enter the shared optimizer */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { hasHotelPermission } from "@/lib/access";
import { getRequestLocale } from "@/lib/locale-server";
import { requireSectionAccess } from "@/server/guards";
import { formatMoney } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { RoomStatus } from "@/lib/constants";
import { RoomsGrid } from "@/components/rooms/rooms-grid";
import { ApartmentShare } from "@/components/rooms/apartment-share";
import { WorkflowRow, WorkflowSection, WorkflowStatus } from "@/components/mobile/workflow";
import { apartmentPresentationText } from "@/lib/rooms/presentation";

export const dynamic = "force-dynamic";

export default async function ApartmentProfilePage({ params }: { params: Promise<{ roomId: string }> }) {
  await requireSectionAccess("ROOMS");
  const member = await getCurrentMembership();
  if (!member) notFound();
  const { roomId } = await params;
  const [room, locale] = await Promise.all([
    db.room.findFirst({ where: { id: roomId, hotelId: member.hotelId, hotel: { orgId: member.organizationId } }, include: {
      roomType: { select: { name: true, description: true, capacity: true, basePrice: true } },
      rentalProperty: { select: { publicName: true } },
      communicationProfile: { select: { publicName: true, address: true } },
      ttlockLock: { select: { lockName: true, batteryPercent: true } },
    } }), getRequestLocale(),
  ]);
  if (!room) notFound();
  const kk = locale === "kk";
  const canReadGuestInfo = hasHotelPermission(member, "RESERVATIONS");
  // Reuse the private-photo permission boundary; never expose bytes or storage URLs.
  const photos = canReadGuestInfo ? await db.communicationPhoto.findMany({ where: { roomId: room.id, hotelId: member.hotelId, organizationId: member.organizationId, archivedAt: null }, orderBy: { position: "asc" }, take: 6, select: { id: true } }) : [];
  const name = (canReadGuestInfo && room.communicationProfile?.publicName) || `${kk ? "Пәтер" : "Квартира"} ${room.number}`;
  const price = formatMoney(Number(room.roomType.basePrice));
  const base = `/dashboard/rooms/${encodeURIComponent(room.id)}`;
  const roomVM = { id: room.id, number: room.number, floor: room.floor, status: room.status as RoomStatus, roomTypeId: room.roomTypeId, roomTypeName: room.roomType.name, capacity: room.roomType.capacity, basePrice: Number(room.roomType.basePrice), guestTonight: null };
  return <div className="mx-auto min-w-0 max-w-3xl space-y-6">
    <header className="flex min-w-0 items-center justify-between gap-3"><Link href="/dashboard/rooms" className="inline-flex min-h-11 min-w-0 items-center gap-2 text-sm"><ArrowLeft className="size-4 shrink-0" />{kk ? "Барлық пәтер" : "Все квартиры"}</Link>
      {member.role === "OWNER" ? <Link href={`${base}/edit`} aria-label={kk ? "Пәтерді өзгерту" : "Редактировать квартиру"} className="grid size-11 shrink-0 place-items-center rounded-xl border focus-visible:outline-2 focus-visible:outline-primary"><Pencil className="size-5" /></Link> : <RoomsGrid rooms={[]} roomTypes={[room.roomType.name]} typeDetails={[{ name: room.roomType.name, capacity: room.roomType.capacity, basePrice: Number(room.roomType.basePrice) }]} editRoom={roomVM} addButtonOnly locale={locale} />}
    </header>
    {photos.length ? <section aria-label={kk ? "Пәтер суреттері" : "Фотографии квартиры"} className="grid grid-cols-2 gap-2 overflow-hidden rounded-2xl">{photos.map((photo, index) => <img key={photo.id} src={`/api/communications/photos/${encodeURIComponent(photo.id)}`} alt={`${name} · ${index + 1}`} loading={index ? "lazy" : "eager"} width={800} height={600} className={`aspect-[4/3] w-full object-cover ${index === 0 ? "col-span-2" : ""}`} />)}</section> : <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">{kk ? "Көрсетуге болатын суреттер жоқ" : "Нет доступных фотографий"}</p>}
    <section className="space-y-3"><div><h1 className="break-words text-2xl font-semibold">{name}</h1><p className="mt-2 break-words text-base text-muted-foreground">{room.rentalProperty.publicName} · {kk ? "Қабат" : "Этаж"} {room.floor} · {kk ? "Сыйымдылық" : "Вместимость"}: {room.roomType.capacity}</p>{canReadGuestInfo && room.communicationProfile?.address ? <p className="mt-2 break-words text-base">{room.communicationProfile.address}</p> : null}</div>
      <WorkflowStatus>{t.statuses.room[room.status as RoomStatus]}</WorkflowStatus>
      <p className="text-xl font-semibold">{price} <span className="text-base font-normal text-muted-foreground">/ {kk ? "түн" : "ночь"}</span></p><p className="text-sm text-muted-foreground">{kk ? "Базалық баға мен сыйымдылық пәтер түрінен алынады" : "Базовая цена и вместимость наследуются от типа"}: {room.roomType.name}. {kk ? "Нақты құны күндер мен тарифке байланысты." : "Итоговая стоимость зависит от дат и тарифа."}</p>
    </section>
    {room.roomType.description ? <details className="border-y py-4"><summary className="min-h-11 cursor-pointer text-base font-semibold">{kk ? "Пәтер түрінің сипаттамасы" : "Описание типа квартиры"}</summary><p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed">{room.roomType.description}</p></details> : null}
    <WorkflowSection title={kk ? "Басқару" : "Управление"}>
      <WorkflowRow href={`${base}/access`} title={kk ? "Кіру және құлып" : "Доступ и замок"} detail={room.ttlockLock ? `${kk ? "Байланыстырылған" : "Привязан"} · ${room.ttlockLock.lockName}${room.ttlockLock.batteryPercent !== null ? ` · ${room.ttlockLock.batteryPercent}%` : ""}` : (kk ? "Байланыстырылмаған" : "Не подключён")} />
      {member.role === "OWNER" ? <WorkflowRow href={`${base}/edit`} title={kk ? "Суреттер мен қонаққа нұсқаулар" : "Фотографии и инструкции гостю"} detail={kk ? "Құпия деректер таныстырылымға қосылмайды" : "Приватные данные не входят в презентацию"} /> : null}
      {hasHotelPermission(member, "RATES") ? <WorkflowRow href="/dashboard/rates" title={kk ? "Бағалар мен тарифтер" : "Цены и тарифы"} detail={room.roomType.name} /> : null}
    </WorkflowSection>
    <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4 pb-4">{hasHotelPermission(member, "CALENDAR") ? <Link href={`${base}/calendar`} className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-center text-base font-medium text-primary-foreground"><CalendarDays className="size-5 shrink-0" />{kk ? "Күнтізбені ашу" : "Открыть календарь"}</Link> : null}<ApartmentShare locale={locale} text={apartmentPresentationText({ name, capacity: room.roomType.capacity, nightlyPrice: price, typeDescription: room.roomType.description }, locale)} /></div>
  </div>;
}
