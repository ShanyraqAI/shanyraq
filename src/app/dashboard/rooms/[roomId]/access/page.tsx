import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TTLockWorkspace } from "@/components/ttlock/ttlock-workspace";
import { requireSectionAccess } from "@/server/guards";
import { getCurrentMembership } from "@/lib/tenant";
import { getRequestLocale } from "@/lib/locale-server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function ApartmentAccessPage({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ history?: string }> }) {
  await requireSectionAccess("ROOMS");
  const m = await getCurrentMembership();
  if (!m) notFound();
  const { roomId } = await params;
  const room = await db.room.findFirst({ where: { id: roomId, hotelId: m.hotelId, hotel: { orgId: m.organizationId } }, select: { id: true, number: true } });
  if (!room) notFound();
  const showHistory = (await searchParams).history === "1";
  const kk = (await getRequestLocale()) === "kk";
  return <div className="min-w-0 space-y-5"><Link href={`/dashboard/rooms/${encodeURIComponent(room.id)}`} className="inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft className="size-4" />{kk ? "Пәтерге оралу" : "Назад к квартире"}</Link><h1 className="break-words text-2xl font-semibold">{kk ? "Кіру және құлып" : "Доступ и замок"} · {room.number}</h1><TTLockWorkspace roomId={room.id} showHistory={showHistory} /></div>;
}
