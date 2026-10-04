"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Clock3, Loader2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { runOfflineAction } from "@/lib/offline/actions";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import { CHANNEL_CODES } from "@/lib/constants";
import { cn, formatMoney } from "@/lib/utils";
import { t, channelLabel } from "@/lib/i18n";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";

export interface ReservationFormProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
  compact?: boolean;
  /** "move" shows only unit and dates for quick rescheduling. */
  variant?: "move";
  contextNote?: string;
  initial?: {
    id?: string;
    guestId?: string;
    roomId?: string;
    checkIn?: string;
    checkOut?: string;
    checkInTime?: string;
    checkOutTime?: string;
    adults?: number;
    children?: number;
    ratePlanId?: string;
    pricingMode?: "RATE_PLAN" | "MANUAL";
    totalAmount?: number;
    sourceChannel?: string;
    notes?: string | null;
    paymentMethod?: string | null;
  };
}

const NEW_GUEST = "__new__";

function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReservationFormDialog({
  mode,
  open,
  onOpenChange,
  rooms,
  ratePlans,
  guests,
  hotelCurrency,
  compact = false,
  variant,
  contextNote,
  initial,
}: ReservationFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const moving = variant === "move";
  const [advancedOpen, setAdvancedOpen] = useState(mode === "edit");

  const [guestChoice, setGuestChoice] = useState<string>(
    initial?.guestId ?? (mode === "create" ? NEW_GUEST : ""),
  );
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [roomId, setRoomId] = useState(initial?.roomId ?? rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? todayISO());
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? addDaysISO(todayISO(), 2));
  const [checkInTime, setCheckInTime] = useState(initial?.checkInTime ?? "14:00");
  const [checkOutTime, setCheckOutTime] = useState(initial?.checkOutTime ?? "12:00");
  const [adults, setAdults] = useState(String(initial?.adults ?? 2));
  const [children, setChildren] = useState(String(initial?.children ?? 0));
  const [channel, setChannel] = useState(initial?.sourceChannel ?? "direct");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "CASH" | "UNSPECIFIED">(initial?.paymentMethod === "ONLINE" || initial?.paymentMethod === "CASH" ? initial.paymentMethod : "UNSPECIFIED");

  const selectedRoom = rooms.find((r) => r.id === roomId);
  // Для персонализации: берем базовую цену типа номера как fallback, если тарифов нет
  const selectedRoomTypeBasePrice = useMemo(() => {
    // пробуем найти цену из любого тарифа этого типа, иначе 0 — сервер подставит реальную цену типа
    const anyPlan = ratePlans.find((p) => p.roomTypeId === selectedRoom?.roomTypeId);
    return anyPlan?.basePrice ?? 0;
  }, [ratePlans, selectedRoom]);
  const plansForType = useMemo(
    () => ratePlans.filter((p) => p.roomTypeId === selectedRoom?.roomTypeId),
    [ratePlans, selectedRoom],
  );
  const [planId, setPlanId] = useState(initial?.ratePlanId ?? "");
  // Тариф теперь необязателен: если нет тарифов для типа — используем базовую цену типа
  const effectivePlanId =
    plansForType.length === 0 ? "" : (plansForType.find((p) => p.id === planId)?.id ?? plansForType[0]?.id ?? "");

  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000,
    ),
  );
  const selectedPlan = ratePlans.find((p) => p.id === effectivePlanId);
  const estimate = (selectedPlan?.basePrice ?? selectedRoomTypeBasePrice) * nights;
  const hasPlansForType = plansForType.length > 0;
  const [pricingMode, setPricingMode] = useState<"RATE_PLAN" | "MANUAL">(
    initial?.pricingMode ?? (hasPlansForType ? "RATE_PLAN" : "MANUAL"),
  );
  const [manualTotal, setManualTotal] = useState(
    initial?.pricingMode === "MANUAL" && initial.totalAmount !== undefined ? String(initial.totalAmount) : "",
  );
  const manualAmount = manualTotal.trim() === "" ? Number.NaN : Number(manualTotal);
  const total = pricingMode === "MANUAL" ? manualAmount : estimate;
  const canSubmit = pricingMode === "MANUAL"
    ? Number.isFinite(manualAmount) && manualAmount >= 0
    : hasPlansForType && Boolean(effectivePlanId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (mode === "create") {
        const payload = {
          guestId: guestChoice === NEW_GUEST ? undefined : guestChoice,
          guestName: guestChoice === NEW_GUEST ? newName : undefined,
          guestEmail: guestChoice === NEW_GUEST ? newEmail : "",
          roomId,
          checkIn,
          checkOut,
          checkInTime,
          checkOutTime,
          adults: Number(adults),
          children: Number(children),
          ratePlanId: pricingMode === "RATE_PLAN" ? effectivePlanId : undefined,
          pricingMode,
          manualTotalAmount: pricingMode === "MANUAL" ? manualAmount : undefined,
          sourceChannel: channel as (typeof CHANNEL_CODES)[number],
          notes: notes || undefined,
          paymentMethod: paymentMethod === "UNSPECIFIED" ? null : paymentMethod,
        };
        const result = await runOfflineAction("reservation.create", `Новая бронь · ${checkIn} → ${checkOut}`, payload);
        if (!result.ok) {
          toast.error(result.error ?? t.reservations.toasts.createFailed);
          return;
        }
        toast.success(result.message ?? t.reservations.toasts.created);
        if (result.queued) { onOpenChange(false); return; }
      } else {
        const result = await runOfflineAction("reservation.update", `Изменение брони · ${checkIn} → ${checkOut}`, {
          id: initial!.id,
          guestId: guestChoice === NEW_GUEST ? undefined : guestChoice,
          guestName: guestChoice === NEW_GUEST ? newName : undefined,
          guestEmail: guestChoice === NEW_GUEST ? newEmail : "",
          roomId,
          checkIn,
          checkOut,
          checkInTime,
          checkOutTime,
          adults: Number(adults),
          children: Number(children),
          ratePlanId: pricingMode === "RATE_PLAN" ? effectivePlanId : undefined,
          pricingMode,
          manualTotalAmount: pricingMode === "MANUAL" ? manualAmount : undefined,
          notes: notes || undefined,
          paymentMethod: paymentMethod === "UNSPECIFIED" ? null : paymentMethod,
        });
        if (!result.ok) {
          toast.error(result.error ?? t.reservations.toasts.updateFailed);
          return;
        }
        toast.success(result.message ?? t.reservations.toasts.updated);
        if (result.queued) { onOpenChange(false); return; }
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Не удалось подтвердить сохранение. Обновите календарь перед повторной попыткой.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[92dvh] overflow-y-auto max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:flex max-sm:flex-col max-sm:rounded-none max-sm:bg-[#f8f8f4] max-sm:px-4 max-sm:pt-[max(env(safe-area-inset-top),18px)] max-sm:pb-0 max-sm:ring-0", compact ? "sm:max-w-lg" : "sm:max-w-xl")}>
        <DialogHeader>
          <DialogTitle className="max-sm:text-xl">{moving ? "Перенести бронь" : compact && mode === "create" ? "Быстрая бронь" : mode === "create" ? t.reservations.form.createTitle : t.reservations.form.editTitle}</DialogTitle>
          <DialogDescription className={moving ? "" : "max-sm:hidden"}>
            {moving ? "Выберите новую квартиру и даты. Свободность проверим перед сохранением." : compact && mode === "create"
              ? "Основные данные — без перехода на отдельную страницу."
              : mode === "create"
              ? t.reservations.form.createDescription
              : t.reservations.form.editDescription}
          </DialogDescription>
        </DialogHeader>

        {compact && contextNote ? <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.045] px-3 py-2 text-xs text-foreground"><Clock3 className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>{contextNote}</span></div> : null}

        <form onSubmit={handleSubmit} className={cn(compact ? "space-y-3" : "space-y-4", "max-sm:flex max-sm:flex-1 max-sm:flex-col")}>
          {/* Guest */}
          {!moving ? <div className="space-y-1.5">
            <Label>{t.reservations.form.guest}</Label>
            {guests.length > 0 && (
              <Select value={guestChoice} onValueChange={setGuestChoice}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.reservations.form.selectGuest} />
                </SelectTrigger>
                <SelectContent>
                  {guests.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.fullName}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_GUEST}>{t.reservations.form.newGuestOption}</SelectItem>
                </SelectContent>
              </Select>
            )}
            {guestChoice === NEW_GUEST && (
              <div className="mt-2 grid gap-2">
                <Input
                  placeholder={t.reservations.form.fullNamePlaceholder}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
                <Input
                  className="max-sm:hidden"
                  placeholder={t.reservations.form.emailPlaceholder}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            )}
          </div> : null}

          {/* Room */}
          <div className="space-y-1.5">
            <Label>{t.reservations.form.room}</Label>
            <Select
              value={roomId}
              onValueChange={(v) => {
                setRoomId(v);
                setPlanId("");
                const room = rooms.find((item) => item.id === v);
                if (!ratePlans.some((plan) => plan.roomTypeId === room?.roomTypeId)) setPricingMode("MANUAL");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.reservations.form.selectRoom} />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id} disabled={r.status === "OUT_OF_ORDER"}>
                    {r.number} · {r.roomTypeName} ({t.statuses.room[r.status as keyof typeof t.statuses.room]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 rounded-lg border bg-secondary/20 p-3 max-sm:rounded-2xl max-sm:bg-white">
              <Label htmlFor="checkin">{t.reservations.form.checkIn}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_104px]">
                <Input id="checkin" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
                <Input className="max-sm:hidden" aria-label="Время заезда" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} required />
              </div>
              {!compact ? <p className="text-[11px] text-muted-foreground">Гость занимает вторую половину дня заезда.</p> : null}
            </div>
            <div className="space-y-1.5 rounded-lg border bg-secondary/20 p-3 max-sm:rounded-2xl max-sm:bg-white">
              <Label htmlFor="checkout">{t.reservations.form.checkOut}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_104px]">
                <Input id="checkout" type="date" value={checkOut} min={addDaysISO(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} required />
                <Input className="max-sm:hidden" aria-label="Время выезда" type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} required />
              </div>
              {!compact ? <p className="text-[11px] text-muted-foreground">Первая половина дня остаётся за выезжающим гостем.</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-sm:hidden">
            <div className="space-y-1.5">
              <Label>{t.reservations.form.adults}</Label>
              <Select value={adults} onValueChange={setAdults}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.reservations.form.children}</Label>
              <Select value={children} onValueChange={setChildren}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[0, 1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {!moving ? <section className="space-y-3 rounded-xl border p-3.5 max-sm:rounded-2xl max-sm:bg-white" aria-labelledby="reservation-pricing-title">
            <div>
              <Label id="reservation-pricing-title">Как рассчитать стоимость</Label>
              <p className="hidden text-xs text-muted-foreground sm:block">Выберите готовый тариф или укажите итоговую цену вручную.</p>
            </div>
            <div className="grid h-10 grid-cols-2 gap-1 rounded-lg bg-secondary p-1 max-sm:h-11 max-sm:rounded-xl">
              <button type="button" aria-pressed={pricingMode === "RATE_PLAN"} disabled={!hasPlansForType} onClick={() => setPricingMode("RATE_PLAN")} className="flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors active:scale-100 disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:bg-background aria-pressed:shadow-sm max-sm:h-9 max-sm:rounded-lg max-sm:font-bold max-sm:aria-pressed:bg-[#07866b] max-sm:aria-pressed:text-white"><Tags className="size-3.5" />Из тарифа</button>
              <button type="button" aria-pressed={pricingMode === "MANUAL"} onClick={() => setPricingMode("MANUAL")} className="flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors active:scale-100 aria-pressed:bg-background aria-pressed:shadow-sm max-sm:h-9 max-sm:rounded-lg max-sm:font-bold max-sm:aria-pressed:bg-[#07866b] max-sm:aria-pressed:text-white"><Banknote className="size-3.5" />Вручную</button>
            </div>

            {pricingMode === "RATE_PLAN" ? (
              <div className="space-y-1.5">
                <Label>{t.reservations.form.ratePlan}</Label>
                <Select value={effectivePlanId} onValueChange={setPlanId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={t.reservations.form.selectRatePlan} /></SelectTrigger>
                  <SelectContent>{plansForType.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name} — {formatMoney(plan.basePrice)}{t.reservations.form.perNight}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="manual-total">Итоговая стоимость</Label>
                <div className="relative">
                  <Input id="manual-total" type="number" min="0" step="1" inputMode="decimal" value={manualTotal} onChange={(event) => setManualTotal(event.target.value)} className="pr-14 tabular-nums" placeholder="0" required />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{hotelCurrency}</span>
                </div>
              </div>
            )}

            {!hasPlansForType ? <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Для этой категории ещё нет тарифов — укажите стоимость вручную.</p> : null}
          </section> : null}

          {!moving ? <div className="space-y-1.5 sm:hidden"><Label>Способ оплаты</Label><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="UNSPECIFIED">Не указан</SelectItem><SelectItem value="ONLINE">Онлайн</SelectItem><SelectItem value="CASH">Наличные</SelectItem></SelectContent></Select></div> : null}

          {mode === "create" ? (
            <Button type="button" variant="ghost" size="sm" className="px-0 text-muted-foreground" onClick={() => setAdvancedOpen((value) => !value)}>
              {advancedOpen ? "Скрыть дополнительные параметры" : "Дополнительные параметры"}
            </Button>
          ) : null}

          {advancedOpen && !moving ? (
            <div className="space-y-4 rounded-lg border bg-secondary/20 p-3">
              {guestChoice === NEW_GUEST ? <div className="space-y-1 sm:hidden"><Label>Email гостя · необязательно</Label><Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></div> : null}
              <div className="grid grid-cols-2 gap-2 sm:hidden"><div className="space-y-1"><Label>Время заезда</Label><Input type="time" value={checkInTime} onChange={(event) => setCheckInTime(event.target.value)} /></div><div className="space-y-1"><Label>Время выезда</Label><Input type="time" value={checkOutTime} onChange={(event) => setCheckOutTime(event.target.value)} /></div><div className="space-y-1"><Label>{t.reservations.form.adults}</Label><Select value={adults} onValueChange={setAdults}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>{t.reservations.form.children}</Label><Select value={children} onValueChange={setChildren}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[0, 1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="hidden space-y-1.5 sm:block">
                <Label>Способ оплаты</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="UNSPECIFIED">Не указан</SelectItem><SelectItem value="ONLINE">Онлайн</SelectItem><SelectItem value="CASH">Наличные</SelectItem></SelectContent>
                </Select>
              </div>
              {PRODUCT_AVAILABILITY.channels ? <div className="space-y-1.5">
                  <Label>{t.reservations.form.source}</Label>
                  {mode === "create" ? (
                    <Select value={channel} onValueChange={setChannel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHANNEL_CODES.map((code) => <SelectItem key={code} value={code}>{channelLabel(code)}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <div className="pt-2 text-sm text-muted-foreground">{t.reservations.form.unchanged}</div>}
                </div> : null}
              <div className="space-y-1.5">
                <Label htmlFor="res-notes">{t.reservations.form.notes}</Label>
                <Textarea id="res-notes" placeholder={t.reservations.form.notesPlaceholder} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          ) : null}

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {pricingMode === "RATE_PLAN" ? t.reservations.form.nightsSummary(nights, selectedPlan?.name ?? "—") : `${nights} ноч. · цена указана вручную`}
            </span>
            <span className="font-semibold tabular-nums">{Number.isFinite(total) ? formatMoney(total) : "—"}</span>
          </div>

          <DialogFooter className="sticky bottom-[-12px] z-10 bg-background/95 pt-3 pb-1 backdrop-blur max-sm:mt-auto max-sm:bottom-0 max-sm:-mx-4 max-sm:flex-row max-sm:border-t max-sm:bg-white/95 max-sm:px-4 max-sm:pb-[max(env(safe-area-inset-bottom),12px)] max-sm:[&_button]:h-12 max-sm:[&_button]:flex-1 max-sm:[&_button]:rounded-[13px] max-sm:[&_button]:font-bold">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "create" ? t.reservations.createButton : t.reservations.form.saveChanges}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
