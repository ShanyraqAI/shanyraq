import { cn } from "@/lib/utils";
import type { ConnectionStatus, ReservationStatus, RoomStatus, SyncStatus } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

const RESERVATION_STYLES: Record<ReservationStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CHECKED_IN: { label: "In house", className: "bg-sky-100 text-sky-800 border-sky-200" },
  CHECKED_OUT: { label: "Checked out", className: "bg-secondary text-secondary-foreground border-border" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
  NO_SHOW: { label: "No show", className: "bg-orange-50 text-orange-700 border-orange-200" },
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const s = RESERVATION_STYLES[status] ?? RESERVATION_STYLES.CONFIRMED;
  return (
    <Badge variant="outline" className={cn("font-medium", s.className)}>
      {s.label}
    </Badge>
  );
}

const ROOM_STYLES: Record<RoomStatus, { label: string; className: string }> = {
  AVAILABLE: { label: "Available", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  OCCUPIED: { label: "Occupied", className: "bg-sky-100 text-sky-800 border-sky-200" },
  CLEANING: { label: "Cleaning", className: "bg-violet-100 text-violet-700 border-violet-200" },
  MAINTENANCE: { label: "Maintenance", className: "bg-amber-100 text-amber-800 border-amber-200" },
  OUT_OF_ORDER: { label: "Out of order", className: "bg-red-50 text-red-700 border-red-200" },
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const s = ROOM_STYLES[status] ?? ROOM_STYLES.AVAILABLE;
  return (
    <Badge variant="outline" className={cn("font-medium", s.className)}>
      {s.label}
    </Badge>
  );
}

const CONNECTION_STYLES: Record<ConnectionStatus, { label: string; dot: string }> = {
  CONNECTED: { label: "Connected", dot: "bg-emerald-500" },
  DISCONNECTED: { label: "Not connected", dot: "bg-muted-foreground/40" },
  ERROR: { label: "Error", dot: "bg-red-500" },
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const s = CONNECTION_STYLES[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("size-2 rounded-full", s.dot)} />
      <span className="font-medium">{s.label}</span>
    </span>
  );
}

const SYNC_STYLES: Record<SyncStatus, { label: string; className: string }> = {
  RUNNING: { label: "Running", className: "bg-sky-100 text-sky-800 border-sky-200" },
  SUCCESS: { label: "Success", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PARTIAL: { label: "Partial", className: "bg-amber-100 text-amber-800 border-amber-200" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200" },
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const s = SYNC_STYLES[status] ?? SYNC_STYLES.FAILED;
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", s.className)}>
      {status.toLowerCase()}
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
      <span>{channel === "booking" ? "Booking.com" : channel.charAt(0).toUpperCase() + channel.slice(1)}</span>
    </span>
  );
}
