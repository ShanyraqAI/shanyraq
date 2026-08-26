"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Cable,
  Clock,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatusBadge, SyncStatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/page-header";
import { ConnectChannelDialog } from "./connect-channel-dialog";
import { syncChannelAction } from "@/server/actions/channels";
import type { RatePlanVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { formatTimeAgo } from "@/lib/utils";

export interface ChannelCardVM {
  id: string;
  name: string;
  description: string;
  isInternal: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  connectionId: string | null;
  externalPropertyId: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  roomMappings: { roomTypeId: string; externalRoomTypeId: string; externalRoomName: string }[];
  rateMappings: { ratePlanId: string; externalRateId: string; externalRateName: string }[];
}

interface Props {
  channels: ChannelCardVM[];
  internalRoomTypes: { id: string; name: string }[];
  internalRatePlans: (RatePlanVM & { roomTypeName: string })[];
}

export function ChannelCards({ channels, internalRoomTypes, internalRatePlans }: Props) {
  const router = useRouter();
  const [dialogChannel, setDialogChannel] = useState<ChannelCardVM | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function handleSync(channel: ChannelCardVM) {
    if (!channel.connectionId) return;
    setSyncingId(channel.id);
    try {
      const result = await syncChannelAction(channel.connectionId);
      if (!result.ok) toast.error(result.error ?? t.channelsPage.cards.syncFailedToast(channel.name));
      else if (result.data?.status === "PARTIAL") toast.warning(result.message);
      else toast.success(result.message);
      router.refresh();
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {channels.map((ch) => (
          <div key={ch.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{ch.name}</h3>
                  {ch.isInternal ? <Badge variant="secondary">{t.channelsPage.cards.builtIn}</Badge> : null}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{ch.description}</p>
              </div>
              {!ch.isInternal && ch.status !== "DISCONNECTED" ? <ConnectionStatusBadge status={ch.status} /> : null}
              {!ch.isInternal && ch.status === "DISCONNECTED" ? (
                <Badge variant="outline" className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {t.statuses.connection.DISCONNECTED}
                </Badge>
              ) : null}
            </div>

            {/* Connection facts */}
            <dl className="mt-4 space-y-1.5 text-sm">
              {ch.externalPropertyId ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t.channelsPage.summary.propertyId}</dt>
                  <dd className="font-mono text-xs leading-5">{ch.externalPropertyId}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t.channelsPage.summary.lastSync}</dt>
                <dd className="flex items-center gap-2">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {formatTimeAgo(ch.lastSyncAt ? new Date(ch.lastSyncAt) : null)}
                  {ch.lastSyncStatus ? <SyncStatusBadge status={ch.lastSyncStatus as never} /> : null}
                </dd>
              </div>
              {(ch.roomMappings.length > 0 || ch.rateMappings.length > 0) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t.channelsPage.cards.mapped}</dt>
                  <dd className="tabular-nums">
                    {t.channelsPage.cards.mappedValue(ch.roomMappings.length, ch.rateMappings.length)}
                  </dd>
                </div>
              )}
              {ch.lastError ? (
                <div className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span className="line-clamp-2">{ch.lastError}</span>
                </div>
              ) : null}
            </dl>

            {/* Actions */}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              {ch.isInternal ? (
                <span className="text-xs text-muted-foreground">{t.channelsPage.cards.internalNote}</span>
              ) : ch.status === "DISCONNECTED" ? (
                <Button size="sm" onClick={() => setDialogChannel(ch)}>
                  <Cable className="mr-1.5 size-3.5" /> {t.common.connect}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" disabled={syncingId !== null} onClick={() => handleSync(ch)}>
                    {syncingId === ch.id ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 size-3.5" />
                    )}
                    {t.channelsPage.cards.sync}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDialogChannel(ch)}>
                    <Settings2 className="mr-1.5 size-3.5" /> {t.channelsPage.cards.mapping}
                  </Button>
                  <Link
                    href={`/dashboard/channels/${ch.id}`}
                    className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t.channelsPage.cards.logs}
                  </Link>
                </>
              )}
            </div>
          </div>
        ))}
        {channels.every((c) => c.isInternal) ? (
          <EmptyState icon={Cable} title={t.channelsPage.cards.empty} />
        ) : null}
      </div>

      {dialogChannel && (
        <ConnectChannelDialog
          channel={{
            id: dialogChannel.id,
            name: dialogChannel.name,
            status: dialogChannel.status,
            connectionId: dialogChannel.connectionId,
            externalPropertyId: dialogChannel.externalPropertyId,
          }}
          open={Boolean(dialogChannel)}
          onOpenChange={(o) => !o && setDialogChannel(null)}
          internalRoomTypes={internalRoomTypes}
          internalRatePlans={internalRatePlans}
          initialRoomMappings={dialogChannel.roomMappings}
          initialRateMappings={dialogChannel.rateMappings}
        />
      )}
    </>
  );
}
