import Link from "next/link";
import { AlertTriangle, Cable, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectionStatusBadge } from "@/components/shared/status-badge";
import { SyncAllButton } from "@/components/channels/sync-all-button";
import type { ChannelHealthRow } from "@/lib/stats";
import { formatTimeAgo } from "@/lib/utils";
import { t, channelLabel } from "@/lib/i18n";

export function ChannelHealthCard({ rows }: { rows: ChannelHealthRow[] }) {
  const connected = rows.filter((r) => r.status === "CONNECTED").length;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{t.channelsPage.health.title}</CardTitle>
          <CardDescription>
            {t.channelsPage.health.subtitle(connected, rows.length)}
          </CardDescription>
        </div>
        <SyncAllButton />
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.channelId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
              <div className="min-w-[140px] font-medium">
                {channelLabel(row.channelId)}
              </div>
              <div className="w-[150px]">
                <ConnectionStatusBadge status={row.status} />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                {t.channelsPage.health.lastSync} {formatTimeAgo(row.lastSyncAt)}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {row.lastError ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium text-destructive"
                    title={row.lastError}
                  >
                    <AlertTriangle className="size-3.5" /> {t.channelsPage.health.error}
                  </span>
                ) : null}
                <Link
                  href={`/dashboard/channels/${row.channelId}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <Cable className="size-3.5" />
                  {t.channelsPage.health.manage}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
