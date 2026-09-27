import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { ChannelCards, type ChannelCardVM } from "@/components/channels/channel-cards";
import { SyncAllButton } from "@/components/channels/sync-all-button";
import type { RatePlanVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";
import { getSyncIncidentId } from "@/lib/channels/sync-errors";
import { ChannexProvisioningCard, type ChannexProvisioningVM } from "@/components/channels/channex-provisioning-card";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  await requireSectionAccess("FULL");
  const hotelId = await getCurrentHotelId();

  const [channelsRaw, connections, roomTypes, ratePlansRaw, rentalProperties] = await Promise.all([
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
    db.rentalProperty.findMany({
      where: { hotelId, status: { not: "ARCHIVED" } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        roomTypes: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { rooms: { select: { id: true } }, ratePlans: { select: { id: true } } },
        },
        channexProperties: {
          where: { environment: "STAGING" },
          include: { roomTypeMappings: true, ratePlanMappings: true },
        },
      },
    }),
  ]);

  const channexProperties: ChannexProvisioningVM[] = rentalProperties.map((rentalProperty) => {
    const channexProperty = rentalProperty.channexProperties[0];
    const roomTypeCount = rentalProperty.roomTypes.length;
    const roomCount = rentalProperty.roomTypes.reduce((total, roomType) => total + roomType.rooms.length, 0);
    const ratePlanCount = rentalProperty.roomTypes.reduce((total, roomType) => total + roomType.ratePlans.length, 0);
    const prerequisites: string[] = [];
    if (roomTypeCount === 0) prerequisites.push("добавьте тип размещения");
    if (roomCount === 0) prerequisites.push("добавьте хотя бы одну единицу размещения");
    if (ratePlanCount === 0) prerequisites.push("добавьте хотя бы один тариф");
    const readyRoomTypes = channexProperty?.roomTypeMappings.filter((item) => item.provisioningStatus === "PROVISIONED").length ?? 0;
    const readyRatePlans = channexProperty?.ratePlanMappings.filter((item) => item.provisioningStatus === "PROVISIONED").length ?? 0;
    return {
      rentalPropertyId: rentalProperty.id,
      propertyName: rentalProperty.publicName,
      status: (channexProperty?.provisioningStatus ?? "NOT_STARTED") as ChannexProvisioningVM["status"],
      complete: channexProperty?.provisioningStatus === "READY"
        && readyRoomTypes === roomTypeCount
        && readyRatePlans === ratePlanCount,
      propertyId: channexProperty?.propertyId ?? null,
      roomTypes: { ready: readyRoomTypes, total: roomTypeCount },
      ratePlans: { ready: readyRatePlans, total: ratePlanCount },
      lastError: channexProperty?.lastErrorMessage ?? null,
      apiConfigured: Boolean(process.env.CHANNEX_STAGING_API_KEY?.trim()),
      prerequisites,
    };
  });

  const internalRatePlans: (RatePlanVM & { roomTypeName: string })[] = ratePlansRaw.map((p) => ({
    id: p.id,
    sequenceNumber: p.sequenceNumber,
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
        Подключение Channex ниже создаёт только структуру в тестовой среде. Остальные карточки каналов пока используют тестовые адаптеры.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {channexProperties.map((channex) => (
          <ChannexProvisioningCard key={channex.rentalPropertyId} value={channex} />
        ))}
      </div>
      <ChannelCards
        channels={cards}
        internalRoomTypes={roomTypes}
        internalRatePlans={internalRatePlans}
      />
    </div>
  );
}
