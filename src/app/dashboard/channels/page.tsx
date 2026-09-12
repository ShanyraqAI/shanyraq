import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { ChannelCards, type ChannelCardVM } from "@/components/channels/channel-cards";
import { SyncAllButton } from "@/components/channels/sync-all-button";
import type { RatePlanVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";
import { getSyncIncidentId } from "@/lib/channels/sync-errors";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  await requireSectionAccess("FULL");
  const hotelId = await getCurrentHotelId();

  const [channelsRaw, connections, roomTypes, ratePlansRaw] = await Promise.all([
    db.channel.findMany({ orderBy: [{ isInternal: "asc" }, { name: "asc" }] }),
    db.channelConnection.findMany({
      where: { hotelId },
      include: { roomMappings: true, rateMappings: true },
    }),
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.ratePlan.findMany({
      where: { hotelId },
      include: { roomType: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const internalRatePlans: (RatePlanVM & { roomTypeName: string })[] = ratePlansRaw.map((p) => ({
    id: p.id,
    name: p.name,
    roomTypeId: p.roomTypeId,
    roomTypeName: p.roomType.name,
    basePrice: Number(p.basePrice),
    currency: p.currency,
    refundable: p.refundable,
    breakfastIncluded: p.breakfastIncluded,
  }));

  const cards: ChannelCardVM[] = channelsRaw.map((ch) => {
    const conn = connections.find((c) => c.channelId === ch.id);
    return {
      id: ch.id,
      name: ch.name,
      description: ch.description,
      isInternal: ch.isInternal,
      status: (conn?.status ?? "DISCONNECTED") as ChannelCardVM["status"],
      connectionId: conn?.id ?? null,
      externalPropertyId: conn?.externalPropertyId ?? null,
      lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: conn?.lastSyncStatus ?? null,
      syncFailed: conn?.lastSyncStatus === "FAILED" || conn?.status === "ERROR" || Boolean(conn?.lastError),
      incidentId: getSyncIncidentId(conn?.lastError),
      roomMappings: conn
        ? conn.roomMappings.map((m) => ({
            roomTypeId: m.roomTypeId,
            externalRoomTypeId: m.externalRoomTypeId,
            externalRoomName: m.externalRoomName,
          }))
        : [],
      rateMappings: conn
        ? conn.rateMappings.map((m) => ({
            ratePlanId: m.ratePlanId,
            externalRateId: m.externalRateId,
            externalRateName: m.externalRateName,
          }))
        : [],
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.channelsPage.title}
        description={t.channelsPage.description}
      >
        <SyncAllButton />
      </PageHeader>
      <p className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
        Внешние каналы пока работают через тестовые адаптеры. Реальные API-вызовы не выполняются.
      </p>
      <ChannelCards
        channels={cards}
        internalRoomTypes={roomTypes}
        internalRatePlans={internalRatePlans}
      />
    </div>
  );
}
