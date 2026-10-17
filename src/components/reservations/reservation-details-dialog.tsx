"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CalendarRange,
  CheckCheck,
  ExternalLink,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  Phone,
  MessageCircle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ReservationStatusBadge, ChannelLabel } from "@/components/shared/status-badge";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { runOfflineAction } from "@/lib/offline/actions";
import { reservationDisplayId, type GuestVM, type RatePlanVM, type ReservationVM, type RoomVM } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { formatMediumDate } from "@/lib/dates";
import { t, channelLabel } from "@/lib/i18n";
import { ReservationDocumentsDialog } from "./reservation-documents-dialog";
import { OwnerStayBlock } from "@/components/guest-stay/owner";
import { CommunicationComposer } from "@/components/communications/composer";

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
      <dt className="text-xs font-medium text-muted-foreground max-sm:text-[10px] max-sm:font-bold max-sm:text-[#939991]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium max-sm:text-[13px] max-sm:font-extrabold max-sm:text-[#2d3a33]">{value}</dd>
    </div>
  );
}

// Mobile-only overrides that align shadcn buttons with the app's light green style.
const MOBILE_ACTION = "max-sm:h-11 max-sm:rounded-xl max-sm:border-[#e2e4da] max-sm:bg-white max-sm:font-bold max-sm:text-[#16826a] max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)] max-sm:focus-visible:border-[#07866b] max-sm:focus-visible:ring-[#07866b]/20";

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
  const [editing, setEditing] = useState<"edit" | "move" | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const callNumber = r.guestPhone?.replace(/[^+\d]/g, "") ?? "";

  async function changeStatus(status: string) {
    setBusy(status);
    try {
      const result = await runOfflineAction("reservation.status", `Статус брони · ${r.guestName}`, { id: r.id, status });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        onOpenChange(false);
        if (!result.queued) router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!window.confirm(t.reservations.details.cancelConfirm(r.guestName))) return;
    setBusy("CANCELLED");
    try {
      const result = await runOfflineAction("reservation.cancel", `Отмена брони · ${r.guestName}`, r.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        onOpenChange(false);
        if (!result.queued) router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-sm:!inset-0 max-sm:!h-dvh max-sm:!max-h-dvh max-sm:!w-screen max-sm:!max-w-none max-sm:!rounded-none max-sm:border-none max-sm:bg-[#f8f8f4] max-sm:pb-[max(env(safe-area-inset-bottom),12px)] sm:max-w-lg">
          <SheetHeader className="border-b bg-[#f7faf8] max-sm:border-[#eceee7] max-sm:bg-[#f8f8f4] max-sm:pt-[max(env(safe-area-inset-top),16px)]">
            <div className="flex items-center justify-between gap-3 pr-6">
              <SheetTitle className="text-base max-sm:text-xl max-sm:font-extrabold max-sm:tracking-tight max-sm:text-[#17221e]">
                {t.reservations.details.title}{" "}
                <span className="font-mono text-muted-foreground max-sm:font-sans max-sm:text-[#8b9189]">{reservationDisplayId(r.sequenceNumber)}</span>
              </SheetTitle>
              <ReservationStatusBadge status={r.status} />
            </div>
            <SheetDescription className="max-sm:text-xs max-sm:text-[#8b9189]">
              {t.reservations.details.createdBy(formatMediumDate(new Date(r.createdAt)))}
              {r.externalReservationId ? t.reservations.details.importedFrom(channelLabel(r.channel)) : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 max-sm:space-y-3 max-sm:pt-1">
            <div className="flex items-center gap-3 rounded-2xl border border-[#e3e9e4] bg-gradient-to-br from-[#f0f8f4] to-white p-4 shadow-sm max-sm:border-[#e2e4da] max-sm:bg-none max-sm:bg-white max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)]">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary max-sm:size-10 max-sm:bg-[#ddf2ea] max-sm:text-[#14846b]">
                <User className="size-4" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-semibold max-sm:font-extrabold max-sm:text-[#2d3a33]">{r.guestName}</div>
                <div className="truncate text-xs text-muted-foreground max-sm:mt-0.5 max-sm:text-[11px] max-sm:text-[#8f968f]">
                  {r.guestEmail ?? t.reservations.details.noEmail} · {r.guestPhone ?? t.reservations.details.noPhone}
                </div>
              </div>
            </div>

            {r.guestPhone ? <div className="grid grid-cols-2 gap-2"><Button asChild variant="outline" className={`h-11 ${MOBILE_ACTION}`}><a href={`tel:${callNumber}`}><Phone className="size-4" />Позвонить</a></Button><Button className="h-11 max-sm:rounded-xl max-sm:font-bold" onClick={() => setCommunicationOpen(true)}><MessageCircle className="size-4" />Сообщение гостю</Button></div> : null}

            {!r.guestPhone ? <Button className="min-h-11 w-full" onClick={() => setCommunicationOpen(true)}><MessageCircle className="size-4" />Сообщение гостю</Button> : null}

            <OwnerStayBlock reservationId={r.id} roomId={r.roomId} checkIn={r.checkIn} checkOut={r.checkOut} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 max-sm:rounded-2xl max-sm:border max-sm:border-[#e2e4da] max-sm:bg-white max-sm:p-4 max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)]">
              <Field label={t.dashboard.table.room} value={`${r.roomNumber} · ${r.roomTypeName}`} />
              <div className="hidden sm:block"><Field label={t.reservations.details.guestsLabel} value={t.reservations.details.guestsField(r.adults, r.children)} /></div>
              <div className="hidden sm:block"><Field label={t.dashboard.table.channel} value={<ChannelLabel channel={r.channel} />} /></div>
              <Field label={t.reservations.form.checkIn} value={`${formatMediumDate(new Date(`${r.checkIn}T00:00:00Z`))}, ${r.checkInTime}`} />
              <Field label={t.reservations.form.checkOut} value={`${formatMediumDate(new Date(`${r.checkOut}T00:00:00Z`))}, ${r.checkOutTime}`} />
              <Field label="Способ оплаты" value={r.paymentMethod === "CASH" ? "Наличные" : r.paymentMethod === "ONLINE" ? "Онлайн" : "Не указан"} />
              <div className="hidden sm:block"><Field label={t.dashboard.table.nights} value={Math.round((Date.parse(`${r.checkOut}T00:00:00Z`) - Date.parse(`${r.checkIn}T00:00:00Z`)) / 86_400_000)} /></div>
            </dl>

            <Separator className="max-sm:hidden" />

            <div className="flex items-center justify-between rounded-lg border p-3 max-sm:rounded-2xl max-sm:border-none max-sm:bg-[#e4f3ee] max-sm:p-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground max-sm:text-[10px] max-sm:font-bold max-sm:text-[#568276]">{t.reservations.details.total}</div>
                <div className="text-lg font-semibold tabular-nums max-sm:mt-1 max-sm:text-xl max-sm:font-extrabold max-sm:text-[#08745f]">{formatMoney(r.totalAmount)}</div>
                <div className="text-[11px] text-muted-foreground max-sm:text-[#568276]">{r.pricingMode === "MANUAL" ? "Указана вручную" : "Рассчитана по тарифу"}</div>
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
            <section className="space-y-2 sm:hidden">
              <h3 className="text-sm font-extrabold text-[#26352f]">Действия</h3>
              <p className="text-xs text-[#8f968f]">Гостей: {t.reservations.details.guestsField(r.adults, r.children)} · {channelLabel(r.channel)}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className={MOBILE_ACTION} onClick={() => setEditing("edit")}><Pencil className="size-4" />Изменить</Button>
                <Button size="sm" variant="outline" className={MOBILE_ACTION} onClick={() => setDocumentsOpen(true)}><FileText className="size-4" />Документы</Button>
                <Button size="sm" variant="outline" className={MOBILE_ACTION} onClick={() => setEditing("move")}><CalendarRange className="size-4" />Перенести</Button>
                <Button size="sm" variant="outline" className={`${MOBILE_ACTION} max-sm:text-[#b84b42]`} disabled={busy !== null || r.status === "CANCELLED"} onClick={cancel}><Ban className="size-4" />Отменить</Button>
              </div>
            </section>
          </div>

          <SheetFooter className="border-t bg-background/95 pt-4 backdrop-blur max-sm:border-[#e8e8df] max-sm:bg-white/95">
            {/* Status actions */}
            <div className="flex w-full flex-wrap gap-2 max-sm:[&_button]:h-12 max-sm:[&_button]:w-full max-sm:[&_button]:rounded-[13px] max-sm:[&_button]:border-none max-sm:[&_button]:bg-gradient-to-br max-sm:[&_button]:from-[#087b64] max-sm:[&_button]:to-[#075d4d] max-sm:[&_button]:font-bold max-sm:[&_button]:text-white max-sm:[&_button]:shadow-[0_8px_20px_rgb(7_93_77/0.17)]">
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

            <Button size="sm" variant="outline" className="w-full max-sm:hidden" onClick={() => setDocumentsOpen(true)}>
              <FileText className="mr-1.5 size-3.5" /> Документы
            </Button>

            <div className="grid w-full grid-cols-3 gap-2 max-sm:hidden">
              <Button size="sm" onClick={() => setEditing("edit")}>
                <Pencil className="mr-1.5 size-3.5" /> {t.common.edit}
              </Button>
              <Button size="sm" variant="outline" title={t.reservations.details.moveTooltip} onClick={() => setEditing("move")}>
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
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {editing && (
        <ReservationFormDialog
          mode="edit"
          variant={editing === "move" ? "move" : undefined}
          open={Boolean(editing)}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
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
            checkInTime: r.checkInTime,
            checkOutTime: r.checkOutTime,
            adults: r.adults,
            children: r.children,
            ratePlanId: r.ratePlanId ?? undefined,
            pricingMode: r.pricingMode,
            totalAmount: r.totalAmount,
            notes: r.notes ?? "",
            paymentMethod: r.paymentMethod,
          }}
        />
      )}
      <CommunicationComposer reservationId={r.id} open={communicationOpen} onOpenChange={setCommunicationOpen} />
      <ReservationDocumentsDialog reservationId={r.id} open={documentsOpen} onOpenChange={setDocumentsOpen} />
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
