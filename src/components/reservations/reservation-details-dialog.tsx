"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CalendarRange,
  CheckCheck,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ReservationStatusBadge, ChannelLabel } from "@/components/shared/status-badge";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { setReservationStatusAction, cancelReservationAction } from "@/server/actions/reservations";
import type { GuestVM, RatePlanVM, ReservationVM, RoomVM } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { formatMediumDate } from "@/lib/dates";
import { t, channelLabel } from "@/lib/i18n";

export interface ReservationDetailsProps {
  reservation: ReservationVM;
  rooms: RoomVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

export function ReservationDetailsDialog({
  reservation: r,
  rooms,
  ratePlans,
  guests,
  hotelCurrency,
  open,
  onOpenChange,
}: ReservationDetailsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function changeStatus(status: string) {
    setBusy(status);
    try {
      const result = await setReservationStatusAction({ id: r.id, status });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!window.confirm(t.reservations.details.cancelConfirm(r.guestName))) return;
    setBusy("CANCELLED");
    try {
      const result = await cancelReservationAction(r.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <DialogTitle className="text-base">
                {t.reservations.details.title}{" "}
                <span className="font-mono text-muted-foreground">#{r.id.slice(-8).toUpperCase()}</span>
              </DialogTitle>
              <ReservationStatusBadge status={r.status} />
            </div>
            <DialogDescription>
              {t.reservations.details.createdBy(formatMediumDate(new Date(r.createdAt)))}
              {r.externalReservationId ? t.reservations.details.importedFrom(channelLabel(r.channel)) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-4" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-semibold">{r.guestName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.guestEmail ?? t.reservations.details.noEmail} · {r.guestPhone ?? t.reservations.details.noPhone}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label={t.dashboard.table.room} value={`${r.roomNumber} · ${r.roomTypeName}`} />
              <Field label={t.reservations.details.guestsLabel} value={t.reservations.details.guestsField(r.adults, r.children)} />
              <Field label={t.dashboard.table.channel} value={<ChannelLabel channel={r.channel} />} />
              <Field label={t.reservations.form.checkIn} value={formatMediumDate(new Date(`${r.checkIn}T00:00:00Z`))} />
              <Field label={t.reservations.form.checkOut} value={formatMediumDate(new Date(`${r.checkOut}T00:00:00Z`))} />
              <Field label={t.dashboard.table.nights} value={Math.round((Date.parse(`${r.checkOut}T00:00:00Z`) - Date.parse(`${r.checkIn}T00:00:00Z`)) / 86_400_000)} />
            </dl>

            <Separator />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground">{t.reservations.details.total}</div>
                <div className="text-lg font-semibold tabular-nums">{formatMoney(r.totalAmount)}</div>
              </div>
              {r.externalReservationId ? (
                <div className="text-right">
                  <div className="text-xs font-medium text-muted-foreground">{t.reservations.details.externalId}</div>
                  <div className="font-mono text-xs">{r.externalReservationId}</div>
                </div>
              ) : null}
            </div>

            {r.notes ? (
              <div className="rounded-lg border border-dashed bg-secondary/30 p-3 text-sm text-muted-foreground">
                “{r.notes}”
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {/* Status actions */}
            <div className="flex w-full flex-wrap gap-2">
              {r.status === "PENDING" && (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => changeStatus("CONFIRMED")}>
                  {busy === "CONFIRMED" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 size-3.5" />}
                  {t.reservations.confirm}
                </Button>
              )}
              {(r.status === "CONFIRMED" || r.status === "PENDING") && (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => changeStatus("CHECKED_IN")}>
                  {busy === "CHECKED_IN" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <LogIn className="mr-1.5 size-3.5" />}
                  {t.reservations.checkIn}
                </Button>
              )}
              {r.status === "CHECKED_IN" && (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => changeStatus("CHECKED_OUT")}>
                  {busy === "CHECKED_OUT" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <LogOut className="mr-1.5 size-3.5" />}
                  {t.reservations.checkOut}
                </Button>
              )}
              {r.status === "NO_SHOW" && (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => changeStatus("CONFIRMED")}>
                  {t.reservations.details.restore}
                </Button>
              )}
            </div>

            <div className="grid w-full grid-cols-3 gap-2">
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1.5 size-3.5" /> {t.common.edit}
              </Button>
              <Button size="sm" variant="outline" title={t.reservations.details.moveTooltip} onClick={() => setEditing(true)}>
                <CalendarRange className="mr-1.5 size-3.5" /> {t.reservations.details.move}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-red-50 hover:text-destructive"
                disabled={busy !== null || r.status === "CANCELLED"}
                onClick={cancel}
              >
                {busy === "CANCELLED" ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Ban className="mr-1.5 size-3.5" />}
                {t.common.cancel}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <ReservationFormDialog
          mode="edit"
          open={editing}
          onOpenChange={(o) => {
            setEditing(o);
            if (!o) onOpenChange(false);
          }}
          rooms={rooms}
          ratePlans={ratePlans}
          guests={guests}
          hotelCurrency={hotelCurrency}
          initial={{
            id: r.id,
            guestId: r.guestId,
            roomId: r.roomId,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            adults: r.adults,
            children: r.children,
            ratePlanId: ratePlans.find((p) => p.roomTypeId === r.roomTypeId)?.id,
            notes: r.notes ?? "",
          }}
        />
      )}
    </>
  );
}

/** Small helper reused by tables to show a subtle external-id chip. */
export function ExternalIdChip({ id }: { id: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border bg-secondary/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      <ExternalLink className="size-3" />
      {id}
    </span>
  );
}
