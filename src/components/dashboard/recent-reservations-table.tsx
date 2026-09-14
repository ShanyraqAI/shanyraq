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
import { t, channelLabel } from "@/lib/i18n";
import { formatISOCompactDate } from "@/lib/dates";
import { reservationDisplayId } from "@/lib/types";

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
            <SelectValue placeholder={t.filters.channel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.filters.allChannels}</SelectItem>
            {channelsPresent.map((c) => (
              <SelectItem key={c} value={c}>
                {channelLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[170px]">
            <SelectValue placeholder={t.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.filters.allStatuses}</SelectItem>
            {(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as ReservationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {t.statuses.reservation[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link href="/dashboard/reservations" className="ml-auto text-sm font-medium text-primary hover:underline">
          {t.nav.reservations}
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead>{t.dashboard.table.reservation}</TableHead>
                <TableHead>{t.dashboard.table.guest}</TableHead>
                <TableHead>{t.dashboard.table.room}</TableHead>
                <TableHead>{t.dashboard.table.dates}</TableHead>
                <TableHead>{t.dashboard.table.channel}</TableHead>
                <TableHead className="text-right">{t.dashboard.table.amount}</TableHead>
                <TableHead>{t.dashboard.table.status}</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {filtered.slice(0, 8).map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => setSelected(r)}
              >
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {reservationDisplayId(r.sequenceNumber)}
                </TableCell>
                <TableCell className="font-medium">{r.guestName}</TableCell>
                <TableCell>{r.roomNumber}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatISOCompactDate(r.checkIn)} → {formatISOCompactDate(r.checkOut)}
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
                  {t.filters.noMatch}
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
