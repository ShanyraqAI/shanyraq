import { cn } from "@/lib/utils";
import type { ConnectionStatus, ReservationStatus, RoomStatus, SyncStatus } from "@/lib/constants";
import { t, channelLabel } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

const RESERVATION_STYLES: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CHECKED_IN: "bg-sky-100 text-sky-800 border-sky-200",
  CHECKED_OUT: "bg-secondary text-secondary-foreground border-border",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  NO_SHOW: "bg-orange-50 text-orange-700 border-orange-200",
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", RESERVATION_STYLES[status] ?? RESERVATION_STYLES.CONFIRMED)}>
      {t.statuses.reservation[status] ?? t.statuses.reservation.CONFIRMED}
    </Badge>
  );
}

const ROOM_STYLES: Record<RoomStatus, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OCCUPIED: "bg-sky-100 text-sky-800 border-sky-200",
  CLEANING: "bg-violet-100 text-violet-700 border-violet-200",
  MAINTENANCE: "bg-amber-100 text-amber-800 border-amber-200",
  OUT_OF_ORDER: "bg-red-50 text-red-700 border-red-200",
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ROOM_STYLES[status] ?? ROOM_STYLES.AVAILABLE)}>
      {t.statuses.room[status] ?? t.statuses.room.AVAILABLE}
    </Badge>
  );
}

const CONNECTION_DOTS: Record<ConnectionStatus, { dot: string }> = {
  CONNECTED: { dot: "bg-emerald-500" },
  DISCONNECTED: { dot: "bg-muted-foreground/40" },
  ERROR: { dot: "bg-red-500" },
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const s = CONNECTION_DOTS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("size-2 rounded-full", s.dot)} />
      <span className="font-medium">{t.statuses.connection[status]}</span>
    </span>
  );
}

const SYNC_STYLES: Record<SyncStatus, string> = {
  RUNNING: "bg-sky-100 text-sky-800 border-sky-200",
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIAL: "bg-amber-100 text-amber-800 border-amber-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", SYNC_STYLES[status] ?? SYNC_STYLES.FAILED)}>
      {t.statuses.sync[status] ?? t.statuses.sync.FAILED}
    </Badge>
  );
}

const CHANNEL_DOTS: Record<string, string> = {
  booking: "#003580",
  ostrovok: "#ff6d00",
  krisha: "#0ea5e9",
  direct: "#059669",
};

export function ChannelLabel({ channel, className }: { channel: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: CHANNEL_DOTS[channel] ?? "#94a3b8" }}
      />
      <span>{channelLabel(channel)}</span>
    </span>
  );
}
