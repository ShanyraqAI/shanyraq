import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileClock } from "lucide-react";
import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { ConnectionStatusBadge, SyncStatusBadge } from "@/components/shared/status-badge";
import { MappingEditor } from "@/components/channels/mapping-editor";
import { SyncConnectionButton } from "@/components/channels/sync-connection-button";
import type { ExternalInventory } from "@/lib/channels/types";
import type { RatePlanVM } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel: channelId } = await params;
  const hotelId = await getCurrentHotelId();

  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.isInternal) notFound();

  const [connection, roomTypes, ratePlansRaw] = await Promise.all([
    db.channelConnection.findFirst({
      where: { hotelId, channelId },
      include: { roomMappings: true, rateMappings: true },
    }),
    db.roomType.findMany({
      where: { hotelId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
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
    basePrice: p.basePrice,
    currency: p.currency,
    refundable: p.refundable,
    breakfastIncluded: p.breakfastIncluded,
  }));

  // Mock providers expose their catalogue without a live connection.
  const { getChannelProvider } = await import("@/lib/channels/provider-registry");
  const inventory: ExternalInventory =
    connection?.status === "CONNECTED"
      ? await getChannelProvider(channelId).fetchExternalInventory({
          connectionId: connection.id,
          channelId: channelId as never,
          hotelId,
          externalPropertyId: connection.externalPropertyId,
          credentials: null,
          importCursor: connection.importCursor,
        })
      : await getChannelProvider(channelId).fetchExternalInventory({
          connectionId: "",
          channelId: channelId as never,
          hotelId,
          externalPropertyId: null,
          credentials: null,
          importCursor: 0,
        });

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/channels"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All channels
      </Link>

      <PageHeader title={channel.name} description={channel.description}>
        {connection?.status === "CONNECTED" ? (
          <>
            <Link
              href={`/dashboard/channels/${channelId}/logs`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <FileClock className="size-4" /> Sync logs
            </Link>
            <SyncConnectionButton connectionId={connection.id} />
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Connect this channel from the Channels page to enable synchronization.
          </span>
        )}
      </PageHeader>

      {/* Connection summary */}
      <section className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
          <dd className="mt-1.5">
            <ConnectionStatusBadge status={(connection?.status ?? "DISCONNECTED") as never} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Property ID</dt>
          <dd className="mt-1 font-mono text-sm">{connection?.externalPropertyId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last sync</dt>
          <dd className="mt-1 flex items-center gap-2 text-sm">
            {formatTimeAgo(connection?.lastSyncAt ?? null)}
            {connection?.lastSyncStatus ? <SyncStatusBadge status={connection.lastSyncStatus as never} /> : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Credentials</dt>
          <dd className="mt-1 text-sm text-muted-foreground">
            Stored server-side · never exposed to the browser
          </dd>
        </div>
      </section>

      {/* Mappings */}
      {!connection ? (
        <EmptyState
          icon={FileClock}
          title={`${channel.name} is not connected`}
          description="Connect the channel first — then map rooms and rates here."
        />
      ) : (
        <MappingEditor
          connectionId={connection.id}
          channelCode={channel.name}
          internalRoomTypes={roomTypes}
          internalRatePlans={internalRatePlans}
          inventory={inventory}
          initialRoomMappings={connection.roomMappings.map((m) => ({
            roomTypeId: m.roomTypeId,
            externalRoomTypeId: m.externalRoomTypeId,
            externalRoomName: m.externalRoomName,
          }))}
          initialRateMappings={connection.rateMappings.map((m) => ({
            ratePlanId: m.ratePlanId,
            externalRateId: m.externalRateId,
            externalRateName: m.externalRateName,
          }))}
        />
      )}
    </div>
  );
}
