"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { createReservationAction, updateReservationAction } from "@/server/actions/reservations";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import { CHANNEL_CODES } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";
import { t, channelLabel } from "@/lib/i18n";

export interface ReservationFormProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
  initial?: {
    id?: string;
    guestId?: string;
    roomId?: string;
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
    ratePlanId?: string;
    sourceChannel?: string;
    notes?: string | null;
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
  initial,
}: ReservationFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [guestChoice, setGuestChoice] = useState<string>(
    initial?.guestId ?? (mode === "create" ? guests[0]?.id ?? NEW_GUEST : ""),
  );
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [roomId, setRoomId] = useState(initial?.roomId ?? rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? todayISO());
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? addDaysISO(todayISO(), 2));
  const [adults, setAdults] = useState(String(initial?.adults ?? 2));
  const [children, setChildren] = useState(String(initial?.children ?? 0));
  const [channel, setChannel] = useState(initial?.sourceChannel ?? "direct");
  const [notes, setNotes] = useState(initial?.notes ?? "");

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
  const canSubmit = hasPlansForType ? !!effectivePlanId : true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          adults: Number(adults),
          children: Number(children),
          ratePlanId: hasPlansForType ? effectivePlanId : undefined,
          sourceChannel: channel as (typeof CHANNEL_CODES)[number],
          notes: notes || undefined,
        };
        const result = await createReservationAction(payload);
        if (!result.ok) {
          toast.error(result.error ?? t.reservations.toasts.createFailed);
          return;
        }
        toast.success(result.message ?? t.reservations.toasts.created);
      } else {
        const result = await updateReservationAction({
          id: initial!.id,
          guestId: guestChoice === NEW_GUEST ? undefined : guestChoice,
          guestName: guestChoice === NEW_GUEST ? newName : undefined,
          guestEmail: guestChoice === NEW_GUEST ? newEmail : "",
          roomId,
          checkIn,
          checkOut,
          adults: Number(adults),
          children: Number(children),
          ratePlanId: effectivePlanId,
          notes: notes || undefined,
        });
        if (!result.ok) {
          toast.error(result.error ?? t.reservations.toasts.updateFailed);
          return;
        }
        toast.success(result.message ?? t.reservations.toasts.updated);
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t.reservations.form.createTitle : t.reservations.form.editTitle}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? t.reservations.form.createDescription
              : t.reservations.form.editDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest */}
          <div className="space-y-1.5">
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
                  placeholder={t.reservations.form.emailPlaceholder}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Room */}
          <div className="space-y-1.5">
            <Label>{t.reservations.form.room}</Label>
            <Select
              value={roomId}
              onValueChange={(v) => {
                setRoomId(v);
                setPlanId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.reservations.form.selectRoom} />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const counts = new Map<string, number>();
                  const labels = new Map<string, string>();
                  for (const r of rooms) {
                    const idx = (counts.get(r.roomTypeId) ?? 0) + 1;
                    counts.set(r.roomTypeId, idx);
                    const total = rooms.filter((x) => x.roomTypeId === r.roomTypeId).length;
                    labels.set(r.id, total > 1 ? `${r.roomTypeName} · ${idx}` : r.roomTypeName);
                  }
                  return rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id} disabled={r.status === "OUT_OF_ORDER"}>
                      {labels.get(r.id)} ({t.statuses.room[r.status as keyof typeof t.statuses.room]})
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="checkin">{t.reservations.form.checkIn}</Label>
              <Input
                id="checkin"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkout">{t.reservations.form.checkOut}</Label>
              <Input
                id="checkout"
                type="date"
                value={checkOut}
                min={addDaysISO(checkIn, 1)}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Occupancy + plan */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t.reservations.form.adults}</Label>
              <Select value={adults} onValueChange={setAdults}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.reservations.form.children}</Label>
              <Select value={children} onValueChange={setChildren}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 space-y-1.5">
              <Label>{t.reservations.form.source}</Label>
              {mode === "create" ? (
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_CODES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {channelLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="pt-2 text-sm text-muted-foreground">{t.reservations.form.unchanged}</div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.reservations.form.ratePlan} <span className="font-normal text-muted-foreground">(необязательно)</span></Label>
            {hasPlansForType ? (
              <Select value={effectivePlanId} onValueChange={setPlanId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.reservations.form.selectRatePlan} />
                </SelectTrigger>
                <SelectContent>
                  {plansForType.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.basePrice)}
                      {t.reservations.form.perNight}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-sm">
                <div className="font-medium">Базовая цена номера — {formatMoney(selectedRoomTypeBasePrice)}{t.reservations.form.perNight}</div>
                <div className="text-xs text-muted-foreground">Для этой категории пока нет тарифов. При создании брони будет использована базовая цена типа номера. Создайте тариф на странице «Тарифы».</div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="res-notes">{t.reservations.form.notes}</Label>
            <Textarea
              id="res-notes"
              placeholder={t.reservations.form.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t.reservations.form.nightsSummary(nights, selectedPlan?.name ?? (hasPlansForType ? "—" : "Базовая цена"))}
            </span>
            <span className="font-semibold tabular-nums">≈ {formatMoney(estimate)}</span>
          </div>

          <DialogFooter>
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
