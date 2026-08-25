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

export function ChannelHealthCard({ rows }: { rows: ChannelHealthRow[] }) {
  const connected = rows.filter((r) => r.status === "CONNECTED").length;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Channel status</CardTitle>
          <CardDescription>
            {connected} of {rows.length} booking channels connected
          </CardDescription>
        </div>
        <SyncAllButton />
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.channelId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
              <div className="min-w-[140px] font-medium">
                {row.channelId === "booking"
                  ? "Booking.com"
                  : row.channelId.charAt(0).toUpperCase() + row.channelId.slice(1)}
              </div>
              <div className="w-[130px]">
                <ConnectionStatusBadge status={row.status} />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                Last sync: {formatTimeAgo(row.lastSyncAt)}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {row.lastError ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium text-destructive"
                    title={row.lastError}
                  >
                    <AlertTriangle className="size-3.5" /> Error
                  </span>
                ) : null}
                <Link
                  href={`/dashboard/channels/${row.channelId}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <Cable className="size-3.5" />
                  Manage
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
