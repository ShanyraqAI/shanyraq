"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReservationStatusBadge, ChannelLabel } from "@/components/shared/status-badge";
import { ReservationDetailsDialog } from "@/components/reservations/reservation-details-dialog";
import type { GuestVM, RatePlanVM, ReservationVM, RoomVM } from "@/lib/types";
import type { ReservationStatus } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";

interface Props {
  reservations: ReservationVM[];
  rooms: RoomVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
}

export function RecentReservationsTable({ reservations, rooms, ratePlans, guests, hotelCurrency }: Props) {
  const router = useRouter();
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<ReservationVM | null>(null);

  const channelsPresent = useMemo(
    () => Array.from(new Set(reservations.map((r) => r.channel))),
    [reservations],
  );

  const filtered = useMemo(
    () =>
      reservations.filter(
        (r) =>
          (channelFilter === "all" || r.channel === channelFilter) &&
          (statusFilter === "all" || r.status === statusFilter),
      ),
    [reservations, channelFilter, statusFilter],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {channelsPresent.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "booking" ? "Booking.com" : c.charAt(0).toUpperCase() + c.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as ReservationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ").toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link href="/dashboard/reservations" className="ml-auto text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead>Reservation</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 8).map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => setSelected(r)}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  #{r.id.slice(-8).toUpperCase()}
                </TableCell>
                <TableCell className="font-medium">{r.guestName}</TableCell>
                <TableCell>{r.roomNumber}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {r.checkIn.slice(5)} → {r.checkOut.slice(5)}
                </TableCell>
                <TableCell>
                  <ChannelLabel channel={r.channel} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(r.totalAmount)}
                </TableCell>
                <TableCell>
                  <ReservationStatusBadge status={r.status} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No reservations match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <ReservationDetailsDialog
          reservation={selected}
          rooms={rooms}
          ratePlans={ratePlans}
          guests={guests}
          hotelCurrency={hotelCurrency}
          open={Boolean(selected)}
          onOpenChange={(o) => {
            if (!o) setSelected(null);
          }}
        />
      )}
      {/* refresh hook keeps table in sync after dialog actions */}
      <span className="hidden" aria-hidden onClick={() => router.refresh()} />
    </div>
  );
}
