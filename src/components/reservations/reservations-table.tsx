"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReservationStatusBadge, ChannelLabel } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/page-header";
import { ReservationDetailsDialog } from "@/components/reservations/reservation-details-dialog";
import { ReservationFormDialog } from "@/components/reservations/reservation-form-dialog";
import { setReservationStatusAction } from "@/server/actions/reservations";
import type { GuestVM, RatePlanVM, ReservationVM, RoomVM } from "@/lib/types";
import type { ReservationStatus } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";
import { t, channelLabel } from "@/lib/i18n";

interface Props {
  reservations: ReservationVM[];
  rooms: RoomVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
}

const STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];

export function ReservationsTable({ reservations, rooms, ratePlans, guests, hotelCurrency }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [selected, setSelected] = useState<ReservationVM | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const channelsPresent = useMemo(() => Array.from(new Set(reservations.map((r) => r.channel))), [reservations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (channel !== "all" && r.channel !== channel) return false;
      if (!q) return true;
      return (
        r.guestName.toLowerCase().includes(q) ||
        r.roomNumber.includes(q) ||
        r.id.toLowerCase().includes(q.toLowerCase())
      );
    });
  }, [reservations, query, status, channel]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      revenue: filtered.filter((r) => !["CANCELLED", "NO_SHOW"].includes(r.status)).reduce((s, r) => s + r.totalAmount, 0),
    }),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.reservations.searchPlaceholder}
            className="w-[240px] pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.filters.allStatuses}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t.statuses.reservation[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue />
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

        <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground tabular-nums">{stats.total}</strong>{" "}
            {t.reservations.statsCount(stats.total)}
          </span>
          <span className="hidden sm:inline">
            <strong className="text-foreground tabular-nums">{formatMoney(stats.revenue, { compact: true })}</strong>{" "}
            {t.reservations.statsBooked}
          </span>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" /> {t.reservations.newButton}
          </Button>
        </div>
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          icon={Plus}
          title={t.reservations.emptyTitle}
          description={t.reservations.emptyDescription}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              {t.reservations.createButton}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead>{t.dashboard.table.id}</TableHead>
                <TableHead>{t.dashboard.table.guest}</TableHead>
                <TableHead>{t.dashboard.table.room}</TableHead>
                <TableHead>{t.dashboard.table.dates}</TableHead>
                <TableHead>{t.dashboard.table.channel}</TableHead>
                <TableHead className="text-right">{t.dashboard.table.amount}</TableHead>
                <TableHead>{t.dashboard.table.status}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">#{r.id.slice(-8).toUpperCase()}</TableCell>
                  <TableCell className="font-medium">{r.guestName}</TableCell>
                  <TableCell>{r.roomNumber}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.checkIn.slice(5)} → {r.checkOut.slice(5)}
                  </TableCell>
                  <TableCell>
                    <ChannelLabel channel={r.channel} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.totalAmount)}</TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t.reservations.quickActions}</DropdownMenuLabel>
                        {(r.status === "CONFIRMED" || r.status === "PENDING") && (
                          <ResAction row={r} label={t.reservations.checkIn} status="CHECKED_IN" onDone={() => setSelected(null)} />
                        )}
                        {r.status === "CHECKED_IN" && (
                          <ResAction row={r} label={t.reservations.checkOut} status="CHECKED_OUT" onDone={() => setSelected(null)} />
                        )}
                        {r.status === "PENDING" && (
                          <ResAction row={r} label={t.reservations.confirm} status="CONFIRMED" onDone={() => setSelected(null)} />
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelected(r)}>{t.common.viewDetails}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    {t.filters.noMatch}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

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

      <ReservationFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        rooms={rooms}
        ratePlans={ratePlans}
        guests={guests}
        hotelCurrency={hotelCurrency}
      />
    </div>
  );
}

function ResAction({
  row,
  label,
  status,
  onDone,
}: {
  row: ReservationVM;
  label: string;
  status: string;
  onDone: () => void;
}) {
  const router = useRouter();
  return (
    <DropdownMenuItem
      onSelect={async () => {
        const result = await setReservationStatusAction({ id: row.id, status });
        if (result.ok) onDone();
        router.refresh();
      }}
    >
      {label}
    </DropdownMenuItem>
  );
}
