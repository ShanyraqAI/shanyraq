import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OwnerStayBlock } from "@/components/guest-stay/owner";
import { requireSectionAccess } from "@/server/guards";
import { getCurrentMembership } from "@/lib/tenant";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  await requireSectionAccess("ROOMS");
  const m = await getCurrentMembership();
  if (process.env.PUBLIC_CATALOG_ENABLED !== "true" || !m || m.role !== "OWNER")
    notFound();
  const { roomId } = await params;
  const room = await db.room.findFirst({
    where: {
      id: roomId,
      hotelId: m.hotelId,
      hotel: { orgId: m.organizationId },
    },
    select: { id: true },
  });
  if (!room) notFound();
  return (
    <div
      className="mx-auto min-w-0 max-w-2xl space-y-5"
      data-clarity-mask="true"
    >
      <Link
        href={`/dashboard/rooms/${encodeURIComponent(roomId)}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm"
      >
        <ArrowLeft size={18} />
        Назад к квартире
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Страница квартиры</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Фото, описание и преимущества — без конструктора сайта.
        </p>
      </header>
      <OwnerStayBlock roomId={roomId} catalogOnly />
    </div>
  );
}
