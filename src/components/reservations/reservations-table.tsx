"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, MoreHorizontal, SlidersHorizontal } from "lucide-react";
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
import { setReservationStatusAction } from "@/server/actions/reservations";
import { findSelectedReservation } from "@/lib/reservations/calendar-selection";
import type { GuestVM, RatePlanVM, ReservationVM, RoomVM } from "@/lib/types";
import type { ReservationStatus } from "@/lib/constants";
import { cn, formatMoney } from "@/lib/utils";
import { t, channelLabel } from "@/lib/i18n";
import { formatISOCompactDate } from "@/lib/dates";
import { reservationDisplayId } from "@/lib/types";
import { mobileCopy, type AppLocale } from "@/lib/locale";

interface Props {
  reservations: ReservationVM[];
  rooms: RoomVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
  todayISO: string;
  initialSelectedId?: string | null;
  locale?: AppLocale;
  initialStatus?: string;
  initialChannel?: string;
  initialDebt?: boolean;
  initialPeriod?: "all" | "today" | "arrivals" | "departures";
}

const STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];

export function ReservationsTable({ reservations, rooms, ratePlans, guests, hotelCurrency, todayISO, initialSelectedId = null, locale = "ru", initialStatus = "all", initialChannel = "all", initialDebt = false, initialPeriod = "all" }: Props) {
  const router = useRouter();
  const copy = mobileCopy[locale].reservations;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [channel, setChannel] = useState(initialChannel);
  const [period, setPeriod] = useState<"all" | "today" | "arrivals" | "departures">(initialPeriod);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const selected = findSelectedReservation(reservations, selectedId);
  const activeMobileFilters = Number(status !== "all") + Number(channel !== "all") + Number(initialDebt);
  const filterParams = new URLSearchParams();
  if (status !== "all") filterParams.set("status", status);
  if (channel !== "all") filterParams.set("channel", channel);
  if (initialDebt) filterParams.set("debt", "1");
  const filterHref = `/dashboard/reservations/filters${filterParams.size ? `?${filterParams}` : ""}`;

  const channelsPresent = useMemo(() => Array.from(new Set(reservations.map((r) => r.channel))), [reservations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations.filter((r) => {
      if (period === "today" && !(r.checkIn <= todayISO && r.checkOut >= todayISO)) return false;
      if (period === "arrivals" && r.checkIn !== todayISO) return false;
      if (period === "departures" && r.checkOut !== todayISO) return false;
      if (status !== "all" && r.status !== status) return false;
      if (channel !== "all" && r.channel !== channel) return false;
      if (initialDebt && r.paymentMethod === "ONLINE") return false;
      if (!q) return true;
      return (
        r.guestName.toLowerCase().includes(q) ||
        r.roomNumber.includes(q) ||
        reservationDisplayId(r.sequenceNumber).toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q.toLowerCase())
      );
    });
  }, [reservations, query, status, channel, period, todayISO, initialDebt]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      revenue: filtered.filter((r) => !["CANCELLED", "NO_SHOW"].includes(r.status)).reduce((s, r) => s + r.totalAmount, 0),
    }),
    [filtered],
  );
  const tomorrowISO = useMemo(() => {
    const date = new Date(`${todayISO}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }, [todayISO]);
  const mobileGroups = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    return [
      { key: "today", title: locale === "kk" ? "Бүгін" : "Сегодня", rows: sorted.filter((row) => row.checkIn === todayISO || (row.checkIn < todayISO && row.checkOut > todayISO)) },
      { key: "tomorrow", title: locale === "kk" ? "Ертең" : "Завтра", rows: sorted.filter((row) => row.checkIn === tomorrowISO) },
      { key: "later", title: locale === "kk" ? "Кейін" : "Позже", rows: sorted.filter((row) => row.checkIn > tomorrowISO) },
    ].filter((group) => group.rows.length > 0);
  }, [filtered, locale, todayISO, tomorrowISO]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-[calc(100%-78px)] sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.search}
            className="h-11 w-full rounded-xl border-[#e7e9e0] bg-white pl-8 text-xs sm:h-9 sm:w-[240px] sm:rounded-md"
          />
        </div>
        <Link href={filterHref} className="flex h-11 items-center gap-1 rounded-xl bg-white px-3 text-[10px] font-bold text-[#4d5852] ring-1 ring-[#e7e9e0] sm:hidden"><SlidersHorizontal className="size-3.5" />{locale === "kk" ? "Сүзгі" : "Фильтры"}{activeMobileFilters > 0 ? <span className="grid size-4 place-items-center rounded-full bg-[#07866b] text-[9px] text-white">{activeMobileFilters}</span> : null}</Link>
        <div className="hidden sm:block"><Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-full sm:w-[170px]">
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
        </Select></div>
        <div className="hidden sm:block"><Select value={channel} onValueChange={setChannel}>
          <SelectTrigger size="sm" className="w-full sm:w-[150px]">
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
        </Select></div>

        <div className="flex w-full gap-1.5 overflow-x-auto pb-1 sm:hidden">{([ ["all", `${copy.all} ${reservations.length}`], ["arrivals", `${copy.arrivals} ${reservations.filter((item) => item.checkIn === todayISO).length}`], ["departures", `${copy.departures} ${reservations.filter((item) => item.checkOut === todayISO).length}`], ["today", locale === "kk" ? "Бүгін" : "Сегодня"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value} className="sh-mobile-chip shrink-0 aria-pressed:bg-[#07866b] aria-pressed:text-white">{label}</button>)}</div>

        <div className="flex w-full flex-wrap items-center gap-3 text-sm text-muted-foreground xl:ml-auto xl:w-auto">
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-foreground tabular-nums">{stats.total}</strong>{" "}
              <span className="sm:hidden">{copy.bookings(stats.total).replace(String(stats.total), "").trim()}</span><span className="hidden sm:inline">{t.reservations.statsCount(stats.total)}</span>
            </span>
            <span className="hidden sm:inline">
              <strong className="text-foreground tabular-nums">{formatMoney(stats.revenue, { compact: true })}</strong>{" "}
              {t.reservations.statsBooked}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:inline-flex" aria-label={copy.newBooking} title={copy.newBooking}><Link href="/dashboard/reservations/new"><Plus className="size-4" /><span className="hidden md:inline">{t.reservations.newButton}</span></Link></Button>
          </div>
        </div>
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          icon={Plus}
          title={t.reservations.emptyTitle}
          description={t.reservations.emptyDescription}
          action={
            <Button asChild size="sm"><Link href="/dashboard/reservations/new"><Plus className="mr-1.5 size-4" />{t.reservations.createButton}</Link></Button>
          }
        />
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm sm:block">
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
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedId(r.id)}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{reservationDisplayId(r.sequenceNumber)}</TableCell>
                  <TableCell className="font-medium">{r.guestName}</TableCell>
                  <TableCell>{r.roomNumber}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatISOCompactDate(r.checkIn)} → {formatISOCompactDate(r.checkOut)}
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
                          <ResAction row={r} label={t.reservations.checkIn} status="CHECKED_IN" onDone={() => setSelectedId(null)} />
                        )}
                        {r.status === "CHECKED_IN" && (
                          <ResAction row={r} label={t.reservations.checkOut} status="CHECKED_OUT" onDone={() => setSelectedId(null)} />
                        )}
                        {r.status === "PENDING" && (
                          <ResAction row={r} label={t.reservations.confirm} status="CONFIRMED" onDone={() => setSelectedId(null)} />
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedId(r.id)}>{t.common.viewDetails}</DropdownMenuItem>
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
        <div className="space-y-4 sm:hidden">
          {mobileGroups.map((group) => <section key={group.key}><h2 className="sh-mobile-section-title mb-2">{group.title}</h2><div className="space-y-2">{group.rows.map((r, index) => { const statusPresentation = reservationStatusPresentation(r.status, locale); return <button key={r.id} type="button" onClick={() => router.push(`/dashboard/reservations/${r.id}`)} className="sh-mobile-card block w-full min-w-0 px-3 py-3 text-left"><span className="flex items-start gap-3"><span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-extrabold", index % 3 === 0 ? "bg-[#ddf2ea] text-[#14846b]" : index % 3 === 1 ? "bg-[#e4edfb] text-[#5187d7]" : "bg-[#fbefd8] text-[#c2872e]")}>{new Date(`${r.checkIn}T00:00:00Z`).getUTCDate()}</span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="truncate text-xs font-extrabold text-[#2d3a33]">{r.guestName}</span><span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold", statusPresentation.className)}>{statusPresentation.label}</span></span><span className="mt-1 block truncate text-[10px] text-[#8f968f]">{r.roomNumber} · {formatISOCompactDate(r.checkIn)}—{formatISOCompactDate(r.checkOut)}</span></span></span><span className="mt-2 flex items-center justify-between border-t border-[#f0f1eb] pt-2 text-[9px]"><span className="text-[#959b94]">{r.checkInTime}</span><span className={cn("font-bold", r.totalAmount > 0 ? "text-[#16826a]" : "text-[#ed665e]")}>{formatMoney(r.totalAmount)}</span></span></button>; })}</div></section>)}
          {filtered.length === 0 ? <p className="sh-mobile-card py-10 text-center text-xs text-[#929991]">{t.filters.noMatch}</p> : null}
          <Link href="/dashboard/reservations/new" className="fixed right-4 z-40 grid size-12 place-items-center rounded-full bg-[#07866b] text-white shadow-xl sm:hidden" style={{ bottom: "calc(4.8rem + env(safe-area-inset-bottom))" }} aria-label={copy.newBooking}><Plus className="size-5" /></Link>
        </div>
        </>
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
            if (!o) setSelectedId(null);
          }}
        />
      )}

    </div>
  );
}

function reservationStatusPresentation(status: ReservationStatus, locale: AppLocale) {
  const labels: Record<ReservationStatus, [string, string, string]> = {
    PENDING: ["Ожидает", "Күтуде", "bg-[#fff1d7] text-[#a66b0a]"],
    CONFIRMED: ["Подтверждена", "Расталды", "bg-[#def2e9] text-[#13765f]"],
    CHECKED_IN: ["Заселён", "Келді", "bg-[#dcecff] text-[#376bb0]"],
    CHECKED_OUT: ["Выселен", "Кетті", "bg-[#eee7fb] text-[#7253a5]"],
    CANCELLED: ["Отменена", "Бас тартылды", "bg-[#fde5e2] text-[#b84b42]"],
    NO_SHOW: ["Не заехал", "Келмеді", "bg-[#f0e6e2] text-[#855b4b]"],
  };
  const [ru, kk, className] = labels[status];
  return { label: locale === "kk" ? kk : ru, className };
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
